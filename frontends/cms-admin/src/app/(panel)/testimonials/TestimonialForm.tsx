"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/api/client";
import { Field, TextInput } from "@/components/form/Field";
import { I18nField } from "@/components/form/I18nField";
import { MultiPickField } from "@/components/form/MultiPickField";
import { companyOptions, positionOptions, projectOptions } from "@/components/form/options";
import { Picker } from "@/components/form/Picker";
import { SaveBar } from "@/components/form/SaveBar";
import { applyServerErrors } from "@/components/form/server-errors";
import { SingleMediaField } from "@/components/form/SingleMediaField";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { emptyI18n, i18nOrEmpty, i18nOrNull } from "@/lib/i18n";
import { i18nOptional, i18nRequired, url } from "@/lib/validation";
import type { Company, Media, Position, Project, Testimonial } from "@/types/api";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  author_name: i18nRequired(100),
  author_role: i18nRequired(100),
  company_id: z.string().min(1, "Pick the company"),
  position_id: z.string().min(1, "Pick your position"),
  given_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date").refine((v) => v <= today(), "This date is in the future"),
  quote: i18nOptional(1000, "multiline"),
  media: z.custom<Media | null>(),
  verify_url: url(),
  project_ids: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

function toValues(t: Testimonial | null): Values {
  return {
    author_name: t?.author_name ?? emptyI18n(),
    author_role: t?.author_role ?? emptyI18n(),
    company_id: t?.company.id ?? "",
    position_id: t?.position.id ?? "",
    given_on: t?.given_on ?? "",
    quote: i18nOrEmpty(t?.quote),
    media: t?.media ?? null,
    verify_url: t?.verify_url ?? "",
    project_ids: t?.project_ids ?? [],
  };
}

export function TestimonialForm({
  item,
  companies,
  positions,
  projects,
}: {
  item: Testimonial | null;
  companies: Company[];
  positions: Position[];
  projects: Project[];
}) {
  const router = useRouter();
  const toast = useToast();
  const methods = useForm<Values>({ defaultValues: toValues(item), resolver: zodResolver(schema) });
  const { control, register, handleSubmit, reset, setError, formState } = methods;
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(v: Values) {
    setSaveError(null);
    const body = { ...v, quote: i18nOrNull(v.quote), media_id: v.media?.id ?? null, media: undefined };
    try {
      const { data } = item
        ? await api.put<Testimonial>(`/admin/testimonials/${item.id}`, body)
        : await api.post<Testimonial>("/admin/testimonials", body);
      reset(toValues(data));
      toast(item ? "Testimonial saved." : "Testimonial added.");
      router.push("/testimonials");
      router.refresh();
    } catch (error) {
      setSaveError(applyServerErrors(error, setError, (p) => (p === "media_id" ? "media" : p.replace(/\.\d+$/, ""))));
    }
  }

  const selectorLink = (kind: string, label: string) => (
    <Link href={`/selectors?kind=${kind}`} className="text-accent hover:underline">
      {label}
    </Link>
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(save, () => setSaveError("Some fields need attention."))} noValidate className="space-y-6">
        <Card title="Who said it">
          <div className="grid gap-5 sm:grid-cols-2">
            <I18nField name="author_name" label="Name" required max={100} placeholder="Timur Saidov" />
            <I18nField name="author_role" label="Their role" required max={100} placeholder="Studio Director" />
            <Controller
              control={control}
              name="company_id"
              render={({ field, fieldState }) => (
                <Field label="Their company" htmlFor="t-company" required error={fieldState.error?.message} hint={<>From the {selectorLink("companies", "Companies")} list.</>}>
                  <Picker id="t-company" options={companyOptions(companies)} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} placeholder="Pick a company" invalid={Boolean(fieldState.error)} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="position_id"
              render={({ field, fieldState }) => (
                <Field label="Your position there" htmlFor="t-position" required error={fieldState.error?.message} hint={<>From the {selectorLink("positions", "Positions")} list.</>}>
                  <Picker id="t-position" options={positionOptions(positions)} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} placeholder="Pick a position" invalid={Boolean(fieldState.error)} />
                </Field>
              )}
            />
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Date" htmlFor="t-date" required error={formState.errors.given_on?.message}>
              <TextInput id="t-date" type="date" max={today()} {...register("given_on")} invalid={Boolean(formState.errors.given_on)} />
            </Field>
            <Field label="Verification link" htmlFor="t-verify" required error={formState.errors.verify_url?.message} hint="A public page proving they're real: LinkedIn, Telegram, a website…">
              <TextInput id="t-verify" {...register("verify_url")} placeholder="https://www.linkedin.com/in/…" inputMode="url" invalid={Boolean(formState.errors.verify_url)} />
            </Field>
          </div>
        </Card>

        <Card title="What they said">
          <div className="space-y-5">
            <I18nField name="quote" label="Quote" kind="multiline" rows={5} max={1000} hint="Optional — a video can speak for itself." />
            <Controller
              control={control}
              name="media"
              render={({ field }) => (
                <Field label="Photo or video">
                  <SingleMediaField value={field.value} onChange={field.onChange} imagePurpose="testimonial_image" videoPurpose="testimonial_video" />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="project_ids"
              render={({ field }) => (
                <Field label="Projects it's about" htmlFor="t-projects">
                  <MultiPickField id="t-projects" options={projectOptions(projects)} value={field.value} onChange={field.onChange} emptyText="Add projects on the Projects page first." />
                </Field>
              )}
            />
          </div>
        </Card>

        <SaveBar dirty={formState.isDirty || !item} saving={formState.isSubmitting} error={saveError} onDiscard={() => reset()} label={item ? "Save changes" : "Add testimonial"} />
      </form>
    </FormProvider>
  );
}

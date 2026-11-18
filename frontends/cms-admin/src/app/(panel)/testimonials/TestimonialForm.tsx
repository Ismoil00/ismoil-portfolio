"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/api/client";
import { DateField } from "@/components/form/DateField";
import { Field, TextInput } from "@/components/form/Field";
import { I18nField } from "@/components/form/I18nField";
import { MultiPickField } from "@/components/form/MultiPickField";
import { companyOptions, fieldOptions, projectOptions, techOptions } from "@/components/form/options";
import { Picker } from "@/components/form/Picker";
import { SaveBar } from "@/components/form/SaveBar";
import { applyServerErrors } from "@/components/form/server-errors";
import { SingleMediaField } from "@/components/form/SingleMediaField";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { emptyI18n, i18nOrEmpty, i18nOrNull, LANG_LABELS, LANGS } from "@/lib/i18n";
import { roleLabel } from "@/lib/roles";
import { i18nOptional, i18nRequired, url } from "@/lib/validation";
import type { Company, DevelopmentField, Media, Project, TechStack, Testimonial } from "@/types/api";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z
  .object({
    author_name: i18nRequired(100),
    author_role: i18nRequired(100),
    company_id: z.string().min(1, "Pick the company"),
    // My role: a development field or a technology ("" = not picked). Picking one clears the other.
    field_id: z.string(),
    tech_stack_id: z.string(),
    given_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date").refine((v) => v <= today(), "This date is in the future"),
    quote: i18nOptional(1000, "rich"),
    media: z.custom<Media | null>(),
    verify_url: url(),
    project_ids: z.array(z.string()),
  })
  .refine((v) => Boolean(v.field_id) !== Boolean(v.tech_stack_id), {
    path: ["field_id"],
    message: "Pick a development field or a technology",
  });
type Values = z.infer<typeof schema>;

function toValues(t: Testimonial | null): Values {
  return {
    author_name: t?.author_name ?? emptyI18n(),
    author_role: t?.author_role ?? emptyI18n(),
    company_id: t?.company.id ?? "",
    field_id: t?.field?.id ?? "",
    tech_stack_id: t?.tech_stack?.id ?? "",
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
  fields,
  techs,
  projects,
}: {
  item: Testimonial | null;
  companies: Company[];
  fields: DevelopmentField[];
  techs: TechStack[];
  projects: Project[];
}) {
  const router = useRouter();
  const toast = useToast();
  const methods = useForm<Values>({ defaultValues: toValues(item), resolver: zodResolver(schema) });
  const { control, register, handleSubmit, reset, setError, setValue, clearErrors, formState } = methods;
  const [fieldId, techId] = useWatch({ control, name: ["field_id", "tech_stack_id"] });
  // What the site will show as "My role", in every language, for the field or technology picked.
  const roleName = fields.find((f) => f.id === fieldId)?.name ?? techs.find((t) => t.id === techId)?.name;
  const role = roleName ? roleLabel(roleName) : null;
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(v: Values) {
    setSaveError(null);
    const body = {
      ...v,
      field_id: v.field_id || null,
      tech_stack_id: v.tech_stack_id || null,
      quote: i18nOrNull(v.quote),
      media_id: v.media?.id ?? null,
      media: undefined,
    };
    try {
      const { data } = item
        ? await api.put<Testimonial>(`/admin/testimonials/${item.id}`, body)
        : await api.post<Testimonial>("/admin/testimonials", body);
      reset(toValues(data));
      toast(item ? "Testimonial saved." : "Testimonial added.");
      router.push("/testimonials");
      router.refresh();
    } catch (error) {
      const toField = (p: string) => (p === "media_id" ? "media" : p === "tech_stack_id" ? "field_id" : p.replace(/\.\d+$/, ""));
      setSaveError(applyServerErrors(error, setError, toField));
    }
  }

  /** Exactly one role: picking a field clears the technology and the other way round. */
  function pickRole(name: "field_id" | "tech_stack_id", value: string | null) {
    const other = name === "field_id" ? "tech_stack_id" : "field_id";
    setValue(name, value ?? "", { shouldDirty: true });
    if (value) setValue(other, "", { shouldDirty: true });
    clearErrors("field_id");
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
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="given_on"
              render={({ field, fieldState }) => (
                <Field label="Date" htmlFor="t-date" required error={fieldState.error?.message}>
                  <DateField id="t-date" mode="day" value={field.value || null} onChange={(v) => field.onChange(v ?? "")} max={today()} invalid={Boolean(fieldState.error)} />
                </Field>
              )}
            />
            <Field label="Verification link" htmlFor="t-verify" required error={formState.errors.verify_url?.message} hint="A public page proving they're real: LinkedIn, Telegram, a website…">
              <TextInput id="t-verify" {...register("verify_url")} placeholder="https://www.linkedin.com/in/…" inputMode="url" invalid={Boolean(formState.errors.verify_url)} />
            </Field>
          </div>
        </Card>

        <Card
          title="My role"
          description={
            <>
              Pick one: a {selectorLink("development-fields", "development field")} or a {selectorLink("tech-stacks", "technology")}. The site adds
              “development”: Frontend development, Python development.
            </>
          }
        >
          <Field error={formState.errors.field_id?.message}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="t-field" className="mb-1.5 block text-sm font-medium text-muted">
                  Development field
                </label>
                <Controller
                  control={control}
                  name="field_id"
                  render={({ field, fieldState }) => (
                    <Picker id="t-field" options={fieldOptions(fields)} value={field.value || null} onChange={(v) => pickRole("field_id", v)} placeholder="Pick a field" invalid={Boolean(fieldState.error)} />
                  )}
                />
              </div>
              <div>
                <label htmlFor="t-tech" className="mb-1.5 block text-sm font-medium text-muted">
                  Technology
                </label>
                <Controller
                  control={control}
                  name="tech_stack_id"
                  render={({ field }) => (
                    <Picker id="t-tech" options={techOptions(techs)} value={field.value || null} onChange={(v) => pickRole("tech_stack_id", v)} placeholder="Pick a technology" invalid={Boolean(formState.errors.field_id)} />
                  )}
                />
              </div>
            </div>
          </Field>
          {role && (
            <div className="mt-4 rounded-xl border border-line bg-tint/[0.02] px-4 py-3" aria-live="polite">
              <p className="text-xs text-subtle">Shown on the site as</p>
              <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {LANGS.map((lang) => (
                  <li key={lang} className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold tracking-wide text-faint">{LANG_LABELS[lang]}</span>
                    <span className="font-medium text-fg">{role[lang]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="What they said">
          <div className="space-y-5">
            <I18nField name="quote" label="Quote" kind="rich" max={1000} hint="Optional — a video can speak for itself. Format with the toolbar: bold, italic, underline, lists, links." />
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

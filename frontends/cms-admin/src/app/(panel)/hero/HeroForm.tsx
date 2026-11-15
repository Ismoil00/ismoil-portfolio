"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuCalculator } from "react-icons/lu";
import { api } from "@/api/client";
import { RadioCards } from "@/components/form/Choice";
import { Field } from "@/components/form/Field";
import { FileField } from "@/components/form/FileField";
import { I18nField } from "@/components/form/I18nField";
import { SaveBar } from "@/components/form/SaveBar";
import { applyServerErrors } from "@/components/form/server-errors";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { emptyI18n, i18nOrEmpty, i18nOrNull } from "@/lib/i18n";
import { i18nOptional, i18nRequired } from "@/lib/validation";
import type { Availability, Hero, Media } from "@/types/api";

const schema = z.object({
  first_name: i18nRequired(100, "name"),
  last_name: i18nRequired(100, "name"),
  role: i18nRequired(500),
  description: i18nOptional(1000, "multiline"),
  resume: z.custom<Media | null>((v) => v !== null, { message: "Upload your résumé (PDF)" }),
  availability: z.enum(["seeking", "open", "unavailable"], { message: "Choose your status" }),
});
type Values = z.infer<typeof schema>;

const STATUSES: { value: Availability; label: string; description: string; dot: string }[] = [
  { value: "seeking", label: "Actively looking", description: "“Actively seeking new career opportunities”", dot: "#34d399" },
  { value: "open", label: "Open to good offers", description: "“Open to new career opportunities”", dot: "#fbbf24" },
  { value: "unavailable", label: "Not looking", description: "“Not currently seeking new opportunities”", dot: "#f87171" },
];

function toValues(hero: Hero | null): Values {
  return {
    first_name: hero?.first_name ?? emptyI18n(),
    last_name: hero?.last_name ?? emptyI18n(),
    role: hero?.role ?? emptyI18n(),
    description: i18nOrEmpty(hero?.description),
    resume: hero?.resume ?? null,
    availability: hero?.availability ?? (undefined as unknown as Availability),
  };
}

export function HeroForm({ hero }: { hero: Hero | null }) {
  const router = useRouter();
  const toast = useToast();
  const methods = useForm<Values>({ defaultValues: toValues(hero), resolver: zodResolver(schema) });
  const { control, handleSubmit, reset, setError, formState } = methods;
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(values: Values) {
    setSaveError(null);
    try {
      const { data } = await api.put<Hero>("/admin/hero", {
        first_name: values.first_name,
        last_name: values.last_name,
        role: values.role,
        description: i18nOrNull(values.description),
        resume_id: values.resume?.id,
        availability: values.availability,
      });
      reset(toValues(data));
      toast("Hero saved.");
      router.refresh();
    } catch (error) {
      setSaveError(applyServerErrors(error, setError, (path) => (path === "resume_id" ? "resume" : path)));
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(save, () => setSaveError("Some fields need attention."))} noValidate className="space-y-6">
        <Card title="Name and title">
          <div className="grid gap-5 sm:grid-cols-2">
            <I18nField name="first_name" label="First name" required max={100} hint="One word, no spaces." />
            <I18nField name="last_name" label="Last name" required max={100} hint="One word, no spaces." />
          </div>
          <div className="mt-5 space-y-5">
            <I18nField name="role" label="Title" required max={500} placeholder="Full-stack software engineer" />
            <I18nField
              name="description"
              label="Description"
              kind="multiline"
              rows={3}
              max={1000}
              hint="Shown under the title. Wrap words in **double asterisks** to emphasize them."
            />
          </div>
        </Card>

        <Card title="Résumé" description="Behind every “Download résumé” button. Upload a new version any time; the old file is replaced.">
          <Controller
            control={control}
            name="resume"
            render={({ field, fieldState }) => (
              <Field error={fieldState.error?.message}>
                <FileField purpose="resume" value={field.value} onChange={field.onChange} invalid={Boolean(fieldState.error)} />
              </Field>
            )}
          />
        </Card>

        <Card title="Job-search status" description="The colored badge above your name.">
          <Controller
            control={control}
            name="availability"
            render={({ field, fieldState }) => (
              <Field error={fieldState.error?.message}>
                <RadioCards name="availability" options={STATUSES} value={field.value ?? null} onChange={field.onChange} />
              </Field>
            )}
          />
        </Card>

        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line px-5 py-4 text-sm text-subtle">
          <LuCalculator className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>
            The numbers on the hero (years of experience, projects, certificates, technologies, positions) are counted
            automatically from the other pages — nothing to fill in here.
          </p>
        </div>

        <SaveBar dirty={formState.isDirty} saving={formState.isSubmitting} error={saveError} onDiscard={() => reset()} />
      </form>
    </FormProvider>
  );
}

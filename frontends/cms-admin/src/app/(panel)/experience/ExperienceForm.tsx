"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/api/client";
import { Checkbox } from "@/components/form/Choice";
import { Field } from "@/components/form/Field";
import { I18nField } from "@/components/form/I18nField";
import { DateField } from "@/components/form/DateField";
import { MultiPickField } from "@/components/form/MultiPickField";
import { companyOptions, fieldOptions, projectOptions, techOptions, testimonialOptions } from "@/components/form/options";
import { Picker } from "@/components/form/Picker";
import { SaveBar } from "@/components/form/SaveBar";
import { applyServerErrors } from "@/components/form/server-errors";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { formatDuration, monthsBetween } from "@/lib/dates";
import { emptyI18n } from "@/lib/i18n";
import { currentMonth, i18nRequired, month } from "@/lib/validation";
import type { Company, DevelopmentField, Experience, Project, TechStack, Testimonial } from "@/types/api";

const schema = z
  .object({
    title: i18nRequired(200),
    company_id: z.string().min(1, "Pick the company"),
    start: month(),
    end: month().nullable(),
    is_current: z.boolean(),
    description: i18nRequired(5000, "rich"),
    tech_ids: z.array(z.string()).min(1, "Pick at least one technology"),
    field_ids: z.array(z.string()),
    project_ids: z.array(z.string()),
    testimonial_ids: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (!v.is_current && !v.end) ctx.addIssue({ code: "custom", path: ["end"], message: "Pick the end month, or tick “I work here now”" });
    if (v.end && v.end < v.start) ctx.addIssue({ code: "custom", path: ["end"], message: "The end can't be before the start" });
  });
type Values = z.infer<typeof schema>;

function toValues(item: Experience | null): Values {
  return {
    title: item?.title ?? emptyI18n(),
    company_id: item?.company.id ?? "",
    start: item?.start ?? (null as unknown as string),
    end: item?.end ?? null,
    is_current: item?.is_current ?? false,
    description: item?.description ?? emptyI18n(),
    tech_ids: item?.tech_ids ?? [],
    field_ids: item?.field_ids ?? [],
    project_ids: item?.project_ids ?? [],
    testimonial_ids: item?.testimonial_ids ?? [],
  };
}

export function ExperienceForm({
  item,
  presentElsewhere,
  companies,
  techs,
  fields,
  projects,
  testimonials,
}: {
  item: Experience | null;
  /** Title of another job already marked as present (only one can be). */
  presentElsewhere: string | null;
  companies: Company[];
  techs: TechStack[];
  fields: DevelopmentField[];
  projects: Project[];
  testimonials: Testimonial[];
}) {
  const router = useRouter();
  const toast = useToast();
  const methods = useForm<Values>({ defaultValues: toValues(item), resolver: zodResolver(schema) });
  const { control, handleSubmit, reset, setError, setValue, formState } = methods;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [start, end, isCurrent] = useWatch({ control, name: ["start", "end", "is_current"] });

  async function save(values: Values) {
    setSaveError(null);
    try {
      const body = { ...values, end: values.is_current ? null : values.end };
      const { data } = item
        ? await api.put<Experience>(`/admin/experiences/${item.id}`, body)
        : await api.post<Experience>("/admin/experiences", body);
      reset(toValues(data));
      toast(item ? "Experience saved." : "Experience added.");
      router.push("/experience");
      router.refresh();
    } catch (error) {
      setSaveError(applyServerErrors(error, setError, (p) => p.replace(/\.\d+$/, "")));
    }
  }

  const emptyHint = (what: string, href: string) => (
    <>
      No {what} yet —{" "}
      <Link href={href} className="text-accent hover:underline">
        add them
      </Link>
      .
    </>
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(save, () => setSaveError("Some fields need attention."))} noValidate className="space-y-6">
        <Card title="Position">
          <div className="space-y-5">
            <I18nField name="title" label="Your title" required max={200} placeholder="Full-stack developer" />
            <Controller
              control={control}
              name="company_id"
              render={({ field, fieldState }) => (
                <Field label="Company" htmlFor="exp-company" required error={fieldState.error?.message} hint={<>Logo and website come from the <Link href="/selectors?kind=companies" className="text-accent hover:underline">Companies</Link> list.</>}>
                  <Picker id="exp-company" options={companyOptions(companies)} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} placeholder="Pick a company" invalid={Boolean(fieldState.error)} emptyText={emptyHint("companies", "/selectors?kind=companies")} />
                </Field>
              )}
            />
          </div>
        </Card>

        <Card title="Period" description={start ? `Duration shown on the site: ${formatDuration(monthsBetween(start, isCurrent ? null : end))}` : undefined}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="start"
              render={({ field, fieldState }) => (
                <Field htmlFor="exp-start" label="From" required error={fieldState.error?.message}>
                  <DateField id="exp-start" value={field.value} onChange={field.onChange} max={currentMonth()} invalid={Boolean(fieldState.error)} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="end"
              render={({ field, fieldState }) => (
                <Field htmlFor="exp-end" label="To" required={!isCurrent} error={fieldState.error?.message}>
                  <DateField id="exp-end" value={isCurrent ? null : field.value} onChange={field.onChange} min={start} max={currentMonth()} disabled={isCurrent} invalid={Boolean(fieldState.error)} placeholder={isCurrent ? "Present" : undefined} />
                </Field>
              )}
            />
          </div>
          <Controller
            control={control}
            name="is_current"
            render={({ field, fieldState }) => (
              <div className="mt-4">
                <Checkbox
                  label="I work here now"
                  description={presentElsewhere && !field.value ? undefined : "Shown as “Present”."}
                  blockedReason={
                    presentElsewhere
                      ? `Unavailable: only one position can be marked as current, and “${presentElsewhere}” already is. Set an end month for it first.`
                      : undefined
                  }
                  checked={field.value}
                  disabled={Boolean(presentElsewhere) && !field.value}
                  onChange={(e) => {
                    field.onChange(e.target.checked);
                    if (e.target.checked) setValue("end", null, { shouldDirty: true });
                  }}
                />
                {fieldState.error && <p className="mt-1 text-xs text-danger">{fieldState.error.message}</p>}
              </div>
            )}
          />
        </Card>

        <Card title="What you did" description="Format with the toolbar: bold, italic, underline, lists, links.">
          <I18nField name="description" label="Description" kind="rich" required max={5000} />
        </Card>

        <Card title="Technologies and links">
          <div className="space-y-5">
            <Controller
              control={control}
              name="tech_ids"
              render={({ field, fieldState }) => (
                <Field label="Technologies" htmlFor="exp-techs" required error={fieldState.error?.message} hint="In the order shown on the card.">
                  <MultiPickField id="exp-techs" options={techOptions(techs)} value={field.value} onChange={field.onChange} invalid={Boolean(fieldState.error)} emptyText={emptyHint("technologies", "/selectors?kind=tech-stacks")} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="field_ids"
              render={({ field }) => (
                <Field label="Development fields" htmlFor="exp-fields" hint="Only for the filter on the Experience page.">
                  <MultiPickField id="exp-fields" options={fieldOptions(fields)} value={field.value} onChange={field.onChange} sortable={false} emptyText={emptyHint("development fields", "/selectors?kind=development-fields")} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="project_ids"
              render={({ field }) => (
                <Field label="Key projects" htmlFor="exp-projects">
                  <MultiPickField id="exp-projects" options={projectOptions(projects)} value={field.value} onChange={field.onChange} emptyText={emptyHint("projects", "/projects/new")} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="testimonial_ids"
              render={({ field }) => (
                <Field label="Testimonials" htmlFor="exp-testimonials">
                  <MultiPickField id="exp-testimonials" options={testimonialOptions(testimonials)} value={field.value} onChange={field.onChange} emptyText={emptyHint("testimonials", "/testimonials/new")} />
                </Field>
              )}
            />
          </div>
        </Card>

        <SaveBar dirty={formState.isDirty || !item} saving={formState.isSubmitting} error={saveError} onDiscard={() => reset()} label={item ? "Save changes" : "Add experience"} />
      </form>
    </FormProvider>
  );
}

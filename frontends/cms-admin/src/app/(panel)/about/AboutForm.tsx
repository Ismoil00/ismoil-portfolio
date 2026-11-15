"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuGlobe, LuMail, LuMapPin } from "react-icons/lu";
import { api } from "@/api/client";
import { Checkbox } from "@/components/form/Choice";
import { Field } from "@/components/form/Field";
import { I18nField } from "@/components/form/I18nField";
import { Picker } from "@/components/form/Picker";
import { SaveBar } from "@/components/form/SaveBar";
import { applyServerErrors } from "@/components/form/server-errors";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { emptyI18n, i18nOrEmpty, i18nOrNull } from "@/lib/i18n";
import { countryOptions, flag, offsetLabel, timeZoneOptions } from "@/lib/places";
import { i18nOptional, i18nRequired } from "@/lib/validation";
import type { About } from "@/types/api";

const schema = z.object({
  title: i18nRequired(200),
  paragraph_1: i18nRequired(1000, "multiline"),
  paragraph_2: i18nOptional(1000, "multiline"),
  city: i18nRequired(100),
  country_code: z.string({ message: "Pick a country" }).length(2, "Pick a country"),
  timezone: z.string({ message: "Pick a time zone" }).min(1, "Pick a time zone"),
  open_to_remote: z.boolean(),
  open_to_relocation: z.boolean(),
});
type Values = z.infer<typeof schema>;

function toValues(about: About | null): Values {
  return {
    title: about?.title ?? emptyI18n(),
    paragraph_1: about?.paragraph_1 ?? emptyI18n(),
    paragraph_2: i18nOrEmpty(about?.paragraph_2),
    city: about?.city ?? emptyI18n(),
    country_code: about?.country_code ?? "",
    timezone: about?.timezone ?? "",
    open_to_remote: about?.open_to_remote ?? false,
    open_to_relocation: about?.open_to_relocation ?? false,
  };
}

/** The line the site shows for the two checkboxes. */
function workFormatPreview(remote: boolean, relocation: boolean) {
  if (remote && relocation) return "Open to remote work worldwide and relocation";
  if (remote) return "Open to remote work worldwide";
  if (relocation) return "Open to relocation";
  return null;
}

export function AboutForm({ about }: { about: About | null }) {
  const router = useRouter();
  const toast = useToast();
  const methods = useForm<Values>({ defaultValues: toValues(about), resolver: zodResolver(schema) });
  const { control, handleSubmit, reset, setError, formState } = methods;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [country, timezone, remote, relocation, city] = useWatch({
    control,
    name: ["country_code", "timezone", "open_to_remote", "open_to_relocation", "city.en"],
  });

  const countries = useMemo(
    () => countryOptions().map((c) => ({ value: c.code, label: c.name, icon: <span aria-hidden>{flag(c.code)}</span> })),
    [],
  );
  const zones = useMemo(
    () => timeZoneOptions().map((z) => ({ value: z.zone, label: z.zone.replaceAll("_", " "), note: z.offset })),
    [],
  );
  const countryName = countries.find((c) => c.value === country)?.label;
  const workFormat = workFormatPreview(remote, relocation);

  async function save(values: Values) {
    setSaveError(null);
    try {
      const { data } = await api.put<About>("/admin/about", { ...values, paragraph_2: i18nOrNull(values.paragraph_2) });
      reset(toValues(data));
      toast("About saved.");
      router.refresh();
    } catch (error) {
      setSaveError(applyServerErrors(error, setError));
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(save, () => setSaveError("Some fields need attention."))} noValidate className="space-y-6">
        <Card title="Text">
          <div className="space-y-5">
            <I18nField name="title" label="Title" required max={200} placeholder="Engineer who owns the whole feature" />
            <I18nField name="paragraph_1" label="First paragraph" kind="multiline" rows={5} required max={1000} hint="Shown larger, as the lead." />
            <I18nField name="paragraph_2" label="Second paragraph" kind="multiline" rows={5} max={1000} hint="A blank line starts a new paragraph." />
          </div>
        </Card>

        <Card title="Location">
          <div className="space-y-5">
            <I18nField name="city" label="City" required max={100} placeholder="Dushanbe" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={control}
                name="country_code"
                render={({ field, fieldState }) => (
                  <Field label="Country" htmlFor="about-country" required error={fieldState.error?.message} hint="Translated automatically on the site.">
                    <Picker id="about-country" options={countries} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} placeholder="Pick a country" invalid={Boolean(fieldState.error)} />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="timezone"
                render={({ field, fieldState }) => (
                  <Field label="Time zone" htmlFor="about-zone" required error={fieldState.error?.message} hint="Shown as GMT±N; daylight saving is followed.">
                    <Picker id="about-zone" options={zones} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} placeholder="Pick a time zone" invalid={Boolean(fieldState.error)} />
                  </Field>
                )}
              />
            </div>
          </div>
        </Card>

        <Card title="Work format" description="Each choice changes the line shown on the site.">
          <div className="space-y-3">
            <Controller
              control={control}
              name="open_to_remote"
              render={({ field }) => <Checkbox label="Open to remote work" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            />
            <Controller
              control={control}
              name="open_to_relocation"
              render={({ field }) => <Checkbox label="Open to relocation" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            />
          </div>
        </Card>

        <Card title="Preview" description="The About card on the site (English).">
          <ul className="space-y-3 rounded-xl border border-line bg-tint/[0.02] p-5 text-sm">
            <li className="flex items-center gap-3">
              <LuMapPin className="size-4 text-accent" />
              {city || countryName ? (
                <span>
                  {[city, countryName].filter(Boolean).join(", ")}
                  {timezone && ` (${offsetLabel(timezone)})`}
                </span>
              ) : (
                <span className="text-faint">City, country (GMT±N)</span>
              )}
            </li>
            <li className="flex items-center gap-3">
              <LuGlobe className="size-4 text-accent" />
              {workFormat ?? <span className="text-faint">Hidden — neither box is checked.</span>}
            </li>
            <li className="flex items-center gap-3 text-subtle">
              <LuMail className="size-4 text-accent" />
              <span>
                Email and résumé come from the{" "}
                <Link href="/contacts" className="text-accent underline-offset-4 hover:underline">
                  Contacts
                </Link>{" "}
                and{" "}
                <Link href="/hero" className="text-accent underline-offset-4 hover:underline">
                  Hero
                </Link>{" "}
                pages.
              </span>
            </li>
          </ul>
        </Card>

        <SaveBar dirty={formState.isDirty} saving={formState.isSubmitting} error={saveError} onDiscard={() => reset()} />
      </form>
    </FormProvider>
  );
}

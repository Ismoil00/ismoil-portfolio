"use client";

import { useState } from "react";
import { Controller, FormProvider, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { errorMessage, fieldErrors } from "@/api/errors";
import { createSelector, updateSelector } from "@/api/selectors.api";
import { ColorField } from "@/components/form/ColorField";
import { Field, TextInput } from "@/components/form/Field";
import { I18nField } from "@/components/form/I18nField";
import { IconPicker } from "@/components/form/IconPicker";
import { LogoField } from "@/components/form/LogoField";
import { Picker } from "@/components/form/Picker";
import { Button } from "@/components/ui/Button";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { emptyI18n } from "@/lib/i18n";
import { hexColor, i18nRequired, line, optionalUrl } from "@/lib/validation";
import type { AnySelectorItem, DevelopmentField, Instrument, Media, SelectorKind } from "@/types/api";

/** Every field any selector kind can have; each kind shows and sends only its own. */
interface FormValues {
  name: string;
  nameI18n: { en: string; ru: string; tg: string };
  icon_svg: string | null;
  color: string | null;
  docs_url: string;
  website_url: string;
  logo: Media | null;
  field_ids: string[];
  instrument_ids: string[];
}

const I18N_NAME: SelectorKind[] = ["development-fields", "instruments", "positions", "institutes", "product-types"];
const ICON: SelectorKind[] = ["development-fields", "instruments", "tech-stacks", "product-types", "link-platforms"];
const ICON_REQUIRED: SelectorKind[] = ["tech-stacks", "product-types"];
const WEBSITE: SelectorKind[] = ["companies", "institutes"];

function schemaFor(kind: SelectorKind) {
  const i18n = I18N_NAME.includes(kind);
  return z
    .object({
      name: i18n ? z.string() : line(100),
      nameI18n: i18n ? i18nRequired(kind === "institutes" ? 200 : 100) : z.any(),
      icon_svg: ICON_REQUIRED.includes(kind) ? z.string({ message: "Choose an icon" }).min(1, "Choose an icon") : z.string().nullable(),
      color: kind === "tech-stacks" ? hexColor() : kind === "link-platforms" ? hexColor().nullable() : z.any(),
      docs_url: kind === "tech-stacks" ? optionalUrl() : z.any(),
      website_url: WEBSITE.includes(kind) ? optionalUrl() : z.any(),
      logo: z.any(),
      field_ids: z.array(z.string()),
      instrument_ids: z.array(z.string()),
    })
    .passthrough();
}

function initialValues(item: AnySelectorItem | null): FormValues {
  const values: FormValues = {
    name: "",
    nameI18n: emptyI18n(),
    icon_svg: null,
    color: null,
    docs_url: "",
    website_url: "",
    logo: null,
    field_ids: [],
    instrument_ids: [],
  };
  if (!item) return values;
  const any = item as unknown as Record<string, unknown>;
  if (typeof any.name === "string") values.name = any.name;
  else values.nameI18n = any.name as FormValues["nameI18n"];
  values.icon_svg = (any.icon_svg as string | null) ?? null;
  values.color = (any.color as string | null) ?? null;
  values.docs_url = (any.docs_url as string | null) ?? "";
  values.website_url = (any.website_url as string | null) ?? "";
  values.logo = (any.logo as Media | null) ?? null;
  values.field_ids = (any.field_ids as string[]) ?? [];
  values.instrument_ids = (any.instrument_ids as string[]) ?? [];
  return values;
}

/** The request body for this kind, from the form values. */
function toBody(kind: SelectorKind, v: FormValues): Record<string, unknown> {
  const name = I18N_NAME.includes(kind) ? v.nameI18n : v.name;
  switch (kind) {
    case "development-fields":
    case "instruments":
      return { name, icon_svg: v.icon_svg };
    case "tech-stacks":
      return { name, icon_svg: v.icon_svg, color: v.color, docs_url: v.docs_url || null, field_ids: v.field_ids, instrument_ids: v.instrument_ids };
    case "positions":
      return { name };
    case "companies":
    case "institutes":
      return { name, website_url: v.website_url || null, logo_id: v.logo?.id ?? null };
    case "product-types":
      return { name, icon_svg: v.icon_svg };
    case "link-platforms":
      return { name, icon_svg: v.icon_svg, color: v.color };
  }
}

/** Backend field path → form field path. */
function formPath(kind: SelectorKind, path: string): string {
  if (path.startsWith("name") && I18N_NAME.includes(kind)) return path.replace(/^name/, "nameI18n");
  if (path === "logo_id") return "logo";
  return path.replace(/\.\d+$/, ""); // "field_ids.0" → "field_ids"
}

export function SelectorForm({
  kind,
  item,
  fields,
  instruments,
  onSaved,
  onCancel,
}: {
  kind: SelectorKind;
  item: AnySelectorItem | null;
  fields: DevelopmentField[];
  instruments: Instrument[];
  onSaved: (item: AnySelectorItem) => void;
  onCancel: () => void;
}) {
  const methods = useForm<FormValues>({ defaultValues: initialValues(item), resolver: zodResolver(schemaFor(kind)) as never });
  const { register, control, handleSubmit, setError, formState } = methods;
  const color = useWatch({ control, name: "color" });
  const [formError, setFormError] = useState<string | null>(null);
  const errors = formState.errors;
  const i18n = I18N_NAME.includes(kind);

  async function submit(values: FormValues) {
    setFormError(null);
    try {
      const body = toBody(kind, values);
      onSaved(item ? await updateSelector(kind, item.id, body) : await createSelector(kind, body));
    } catch (error) {
      const found = fieldErrors(error);
      const entries = Object.entries(found);
      entries.forEach(([path, message]) => setError(formPath(kind, path) as Path<FormValues>, { message }));
      if (!entries.length || found._form) setFormError(errorMessage(error));
    }
  }

  const fieldOptions = fields.map((f) => ({
    value: f.id,
    label: f.name.en,
    icon: f.icon_svg ? <SvgIcon svg={f.icon_svg} className="size-4 text-accent" /> : undefined,
  }));
  const instrumentOptions = instruments.map((f) => ({
    value: f.id,
    label: f.name.en,
    icon: f.icon_svg ? <SvgIcon svg={f.icon_svg} className="size-4 text-accent" /> : undefined,
  }));

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        {i18n ? (
          <I18nField name="nameI18n" label="Name" required max={kind === "institutes" ? 200 : 100} />
        ) : (
          <Field label="Name" htmlFor="sel-name" required error={errors.name?.message} hint={kind === "tech-stacks" ? "The same in every language." : undefined}>
            <TextInput id="sel-name" {...register("name")} invalid={Boolean(errors.name)} maxLength={100} autoComplete="off" />
          </Field>
        )}

        {ICON.includes(kind) && (
          <Field
            label="Icon"
            required={ICON_REQUIRED.includes(kind)}
            error={errors.icon_svg?.message}
            hint={kind === "link-platforms" ? "Without an icon, the site shows a globe." : "Single-color; the site paints it."}
          >
            <Controller
              control={control}
              name="icon_svg"
              render={({ field }) => (
                <IconPicker
                  value={field.value}
                  onChange={field.onChange}
                  color={kind === "tech-stacks" || kind === "link-platforms" ? color : undefined}
                  required={ICON_REQUIRED.includes(kind)}
                  invalid={Boolean(errors.icon_svg)}
                />
              )}
            />
          </Field>
        )}

        {(kind === "tech-stacks" || kind === "link-platforms") && (
          <Field
            label="Brand color"
            htmlFor="sel-color"
            required={kind === "tech-stacks"}
            error={errors.color?.message}
            hint={kind === "tech-stacks" ? "Shown when the tile is hovered. White logos turn dark on the light theme automatically." : "Empty = the site's accent blue."}
          >
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <ColorField id="sel-color" value={field.value} onChange={field.onChange} optional={kind === "link-platforms"} invalid={Boolean(errors.color)} />
              )}
            />
          </Field>
        )}

        {kind === "tech-stacks" && (
          <>
            <Field label="Documentation link" htmlFor="sel-docs" error={errors.docs_url?.message} hint="Opened when the tile is clicked.">
              <TextInput id="sel-docs" {...register("docs_url")} placeholder="https://" invalid={Boolean(errors.docs_url)} inputMode="url" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Development fields" htmlFor="sel-fields" hint="Filters it appears under.">
                <Controller
                  control={control}
                  name="field_ids"
                  render={({ field }) => (
                    <Picker id="sel-fields" multiple options={fieldOptions} value={field.value} onChange={field.onChange} placeholder="None" emptyText="Add development fields first." />
                  )}
                />
              </Field>
              <Field label="Instruments" htmlFor="sel-instruments" hint="Filters it appears under.">
                <Controller
                  control={control}
                  name="instrument_ids"
                  render={({ field }) => (
                    <Picker id="sel-instruments" multiple options={instrumentOptions} value={field.value} onChange={field.onChange} placeholder="None" emptyText="Add instruments first." />
                  )}
                />
              </Field>
            </div>
          </>
        )}

        {WEBSITE.includes(kind) && (
          <>
            <Field label="Website" htmlFor="sel-site" error={errors.website_url?.message}>
              <TextInput id="sel-site" {...register("website_url")} placeholder="https://" invalid={Boolean(errors.website_url)} inputMode="url" />
            </Field>
            <Field label="Logo" error={errors.logo?.message as string | undefined}>
              <Controller control={control} name="logo" render={({ field }) => <LogoField value={field.value} onChange={field.onChange} />} />
            </Field>
          </>
        )}

        {formError && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{formError}</p>}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            {item ? "Save changes" : "Add"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

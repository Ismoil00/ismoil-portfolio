"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuBuilding2 } from "react-icons/lu";
import { api } from "@/api/client";
import { Field, TextInput } from "@/components/form/Field";
import { I18nField } from "@/components/form/I18nField";
import { MediaGallery } from "@/components/form/MediaGallery";
import { DateField } from "@/components/form/DateField";
import { MultiPickField } from "@/components/form/MultiPickField";
import { fieldOptions } from "@/components/form/options";
import { Picker } from "@/components/form/Picker";
import { SaveBar } from "@/components/form/SaveBar";
import { applyServerErrors } from "@/components/form/server-errors";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { emptyI18n } from "@/lib/i18n";
import { currentMonth, i18nRequired, month, url } from "@/lib/validation";
import type { Certificate, DevelopmentField, Institute, Media } from "@/types/api";

const schema = z
  .object({
    title: i18nRequired(200),
    institute_id: z.string().min(1, "Pick the institute"),
    start: month(),
    end: month(),
    verify_url: url(),
    field_ids: z.array(z.string()),
    images: z.array(z.custom<Media>()).min(1, "Add at least one image").max(5, "At most 5 images"),
  })
  .superRefine((v, ctx) => {
    if (v.start && v.end && v.end < v.start) ctx.addIssue({ code: "custom", path: ["end"], message: "The end can't be before the start" });
  });
type Values = z.infer<typeof schema>;

function toValues(c: Certificate | null): Values {
  return {
    title: c?.title ?? emptyI18n(),
    institute_id: c?.institute.id ?? "",
    start: c?.start ?? (null as unknown as string),
    end: c?.end ?? (null as unknown as string),
    verify_url: c?.verify_url ?? "",
    field_ids: c?.field_ids ?? [],
    images: c?.images ?? [],
  };
}

export function CertificateForm({
  item,
  institutes,
  fields,
}: {
  item: Certificate | null;
  institutes: Institute[];
  fields: DevelopmentField[];
}) {
  const router = useRouter();
  const toast = useToast();
  const methods = useForm<Values>({ defaultValues: toValues(item), resolver: zodResolver(schema) });
  const { control, register, handleSubmit, reset, setError, formState } = methods;
  const [saveError, setSaveError] = useState<string | null>(null);
  const start = useWatch({ control, name: "start" });

  const instituteOptions = institutes.map((i) => ({
    value: i.id,
    label: i.name.en,
    // eslint-disable-next-line @next/next/no-img-element -- uploaded logo
    icon: i.logo ? <img src={i.logo.url} alt="" className="size-4 object-contain" /> : <LuBuilding2 className="size-4 text-faint" />,
  }));

  async function save(v: Values) {
    setSaveError(null);
    const body = { ...v, image_ids: v.images.map((m) => m.id), images: undefined };
    try {
      const { data } = item
        ? await api.put<Certificate>(`/admin/certificates/${item.id}`, body)
        : await api.post<Certificate>("/admin/certificates", body);
      reset(toValues(data));
      toast(item ? "Certificate saved." : "Certificate added.");
      router.push("/certificates");
      router.refresh();
    } catch (error) {
      setSaveError(applyServerErrors(error, setError, (p) => (p.startsWith("image_ids") ? "images" : p.replace(/\.\d+$/, ""))));
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(save, () => setSaveError("Some fields need attention."))} noValidate className="space-y-6">
        <Card title="Certificate">
          <div className="space-y-5">
            <I18nField name="title" label="Name" required max={200} placeholder="Bachelor's degree — Design of Buildings and Structures" />
            <Controller
              control={control}
              name="institute_id"
              render={({ field, fieldState }) => (
                <Field
                  label="Institute"
                  htmlFor="c-institute"
                  required
                  error={fieldState.error?.message}
                  hint={<>From the <Link href="/selectors?kind=institutes" className="text-accent hover:underline">Institutes</Link> list.</>}
                >
                  <Picker id="c-institute" options={instituteOptions} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} placeholder="Pick an institute" invalid={Boolean(fieldState.error)} />
                </Field>
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={control}
                name="start"
                render={({ field, fieldState }) => (
                  <Field htmlFor="c-start" label="From" required error={fieldState.error?.message}>
                    <DateField id="c-start" value={field.value} onChange={field.onChange} max={currentMonth()} invalid={Boolean(fieldState.error)} />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="end"
                render={({ field, fieldState }) => (
                  <Field htmlFor="c-end" label="To" required error={fieldState.error?.message} hint="Same as “From” for a one-day exam.">
                    <DateField id="c-end" value={field.value} onChange={field.onChange} min={start} max={currentMonth()} invalid={Boolean(fieldState.error)} />
                  </Field>
                )}
              />
            </div>
            <Field label="Verification link" htmlFor="c-verify" required error={formState.errors.verify_url?.message} hint="The issuer's page where anyone can check the certificate.">
              <TextInput id="c-verify" {...register("verify_url")} placeholder="https://" inputMode="url" invalid={Boolean(formState.errors.verify_url)} />
            </Field>
            <Controller
              control={control}
              name="field_ids"
              render={({ field }) => (
                <Field label="Fields of study" htmlFor="c-fields" hint="From the Development fields list; used by the filter on the Certificates page.">
                  <MultiPickField id="c-fields" options={fieldOptions(fields)} value={field.value} onChange={field.onChange} sortable={false} />
                </Field>
              )}
            />
          </div>
        </Card>

        <Card title="Images" description="1 to 5 photos or scans. The first one is the card's thumbnail.">
          <Controller
            control={control}
            name="images"
            render={({ field, fieldState }) => (
              <>
                <MediaGallery value={field.value} onChange={field.onChange} imagePurpose="certificate_image" maxImages={5} invalid={Boolean(fieldState.error)} />
                {fieldState.error && <p className="mt-1 text-xs text-danger">{fieldState.error.message}</p>}
              </>
            )}
          />
        </Card>

        <SaveBar dirty={formState.isDirty || !item} saving={formState.isSubmitting} error={saveError} onDiscard={() => reset()} label={item ? "Save changes" : "Add certificate"} />
      </form>
    </FormProvider>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuCheck, LuLock } from "react-icons/lu";
import { api } from "@/api/client";
import { Checkbox } from "@/components/form/Choice";
import { Field, TextInput } from "@/components/form/Field";
import { I18nField } from "@/components/form/I18nField";
import { MediaGallery } from "@/components/form/MediaGallery";
import { MonthField } from "@/components/form/MonthField";
import { MultiPickField } from "@/components/form/MultiPickField";
import { companyOptions, techOptions, typeOptions } from "@/components/form/options";
import { Picker } from "@/components/form/Picker";
import { SaveBar } from "@/components/form/SaveBar";
import { applyServerErrors } from "@/components/form/server-errors";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { emptyI18n } from "@/lib/i18n";
import { currentMonth, i18nRequired, month, optionalUrl } from "@/lib/validation";
import type { Company, Media, ProductType, Project, TechStack, Traffic } from "@/types/api";

const TRAFFIC: { value: Traffic; label: string }[] = [
  { value: "under100", label: "Under 100" },
  { value: "from100", label: "100 – 1,000" },
  { value: "from1k", label: "1,000 – 10,000" },
  { value: "from10k", label: "10,000 – 100,000" },
  { value: "from100k", label: "100,000 – 1M" },
  { value: "over1m", label: "Over 1M" },
];

const schema = z
  .object({
    title: i18nRequired(200),
    slug: z.string().trim().max(120).refine((v) => v === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), "Lowercase letters, digits and single hyphens only"),
    description: i18nRequired(5000, "multiline"),
    start: month(),
    end: month(),
    client: z.string().min(1, "Choose who it was built for"),
    traffic: z.enum(["under100", "from100", "from1k", "from10k", "from100k", "over1m"], { message: "Choose the monthly traffic" }),
    live_url: optionalUrl(),
    repo_url: optionalUrl(),
    is_private: z.boolean(),
    type_ids: z.array(z.string()).min(1, "Pick at least one product type"),
    tech_ids: z.array(z.string()).min(1, "Pick at least one technology"),
    media: z.array(z.custom<Media>()),
    cover_id: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.end && v.start && v.end < v.start) ctx.addIssue({ code: "custom", path: ["end"], message: "The end can't be before the start" });
    if (!v.is_private && !v.live_url && !v.repo_url)
      ctx.addIssue({ code: "custom", path: ["is_private"], message: "Add a live or source link, or keep it private." });
  });
type Values = z.infer<typeof schema>;

function toValues(p: Project | null): Values {
  return {
    title: p?.title ?? emptyI18n(),
    slug: p?.slug ?? "",
    description: p?.description ?? emptyI18n(),
    start: p?.start ?? (null as unknown as string),
    end: p?.end ?? (null as unknown as string),
    client: p ? (p.client_kind === "company" ? (p.company?.id ?? "") : p.client_kind) : "self",
    traffic: p?.traffic ?? (undefined as unknown as Traffic),
    live_url: p?.live_url ?? "",
    repo_url: p?.repo_url ?? "",
    // A new project has no links yet, so it starts as private (typing a link unticks it).
    is_private: p?.is_private ?? true,
    type_ids: p?.type_ids ?? [],
    tech_ids: p?.tech_ids ?? [],
    media: p?.media ?? [],
    cover_id: p?.cover_id ?? null,
  };
}

const slugify = (text: string) =>
  text.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export function ProjectForm({
  item,
  companies,
  types,
  techs,
}: {
  item: Project | null;
  companies: Company[];
  types: ProductType[];
  techs: TechStack[];
}) {
  const router = useRouter();
  const toast = useToast();
  const methods = useForm<Values>({ defaultValues: toValues(item), resolver: zodResolver(schema) });
  const { control, register, handleSubmit, reset, setError, setValue, getValues, formState } = methods;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPrivate, media, titleEn, start, coverId] = useWatch({ control, name: ["is_private", "media", "title.en", "start", "cover_id"] });

  const clientOptions = [
    { value: "self", label: "Self-initiated project", special: true },
    { value: "private", label: "Private client (name hidden)", special: true },
    ...companyOptions(companies),
  ];

  // No links ⇒ private (ticked automatically while typing); private ⇒ links and media are locked.
  function onLinkChange() {
    const { live_url, repo_url } = getValues();
    setValue("is_private", !live_url.trim() && !repo_url.trim(), { shouldDirty: true });
  }

  function onPrivateChange(checked: boolean) {
    if (checked && media.length > 0) {
      if (!window.confirm(`Private projects show no images or videos. Remove the ${media.length} file(s) from this project?`)) return;
      setValue("media", [], { shouldDirty: true });
      setValue("cover_id", null, { shouldDirty: true });
    }
    if (checked) {
      setValue("live_url", "", { shouldDirty: true });
      setValue("repo_url", "", { shouldDirty: true });
    }
    setValue("is_private", checked, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }

  async function save(v: Values) {
    setSaveError(null);
    const company = v.client !== "self" && v.client !== "private";
    const body = {
      title: v.title,
      slug: v.slug || null,
      description: v.description,
      start: v.start,
      end: v.end,
      client_kind: company ? "company" : v.client,
      company_id: company ? v.client : null,
      traffic: v.traffic,
      live_url: v.live_url || null,
      repo_url: v.repo_url || null,
      is_private: v.is_private,
      type_ids: v.type_ids,
      tech_ids: v.tech_ids,
      media_ids: v.media.map((m) => m.id),
      cover_id: v.cover_id,
    };
    try {
      const { data } = item ? await api.put<Project>(`/admin/projects/${item.id}`, body) : await api.post<Project>("/admin/projects", body);
      reset(toValues(data));
      toast(item ? "Project saved." : "Project added.");
      router.push("/projects");
      router.refresh();
    } catch (error) {
      setSaveError(
        applyServerErrors(error, setError, (p) =>
          p === "company_id" ? "client" : p.startsWith("media_ids") ? "media" : p.replace(/\.\d+$/, ""),
        ),
      );
    }
  }

  const emptyHint = (what: string, kind: string) => (
    <>
      No {what} yet — <Link href={`/selectors?kind=${kind}`} className="text-accent hover:underline">add them</Link>.
    </>
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(save, () => setSaveError("Some fields need attention."))} noValidate className="space-y-6">
        <Card title="About the project">
          <div className="space-y-5">
            <I18nField name="title" label="Title" required max={200} placeholder="Design tokens plugin" />
            <Field label="Page address" htmlFor="project-slug" error={formState.errors.slug?.message} hint="Leave empty to make it from the English title.">
              <div className="flex items-center rounded-xl border border-line bg-tint/[0.03] focus-within:border-accent/70">
                <span className="pl-3.5 text-sm text-faint">/projects/</span>
                <input id="project-slug" {...register("slug")} placeholder={slugify(titleEn ?? "") || "design-tokens-plugin"} className="w-full bg-transparent px-1 py-2.5 text-sm outline-none placeholder:text-faint" spellCheck={false} />
              </div>
            </Field>
            <I18nField name="description" label="Description" kind="multiline" rows={8} required max={5000} hint="A blank line starts a new paragraph; **text** is emphasized." />
          </div>
        </Card>

        <Card title="Details">
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="type_ids"
              render={({ field, fieldState }) => (
                <Field label="Product type" htmlFor="project-types" required error={fieldState.error?.message}>
                  <MultiPickField id="project-types" options={typeOptions(types)} value={field.value} onChange={field.onChange} invalid={Boolean(fieldState.error)} emptyText={emptyHint("product types", "product-types")} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="client"
              render={({ field, fieldState }) => (
                <Field label="Client" htmlFor="project-client" required error={fieldState.error?.message}>
                  <Picker id="project-client" options={clientOptions} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} invalid={Boolean(fieldState.error)} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="start"
              render={({ field, fieldState }) => (
                <Field label="From" required error={fieldState.error?.message}>
                  <MonthField value={field.value} onChange={field.onChange} max={currentMonth()} invalid={Boolean(fieldState.error)} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="end"
              render={({ field, fieldState }) => (
                <Field label="To" required error={fieldState.error?.message}>
                  <MonthField value={field.value} onChange={field.onChange} min={start} max={currentMonth()} invalid={Boolean(fieldState.error)} />
                </Field>
              )}
            />
          </div>
          <Controller
            control={control}
            name="tech_ids"
            render={({ field, fieldState }) => (
              <Field className="mt-5" label="Technologies" htmlFor="project-techs" required error={fieldState.error?.message} hint="The first three show on the card.">
                <MultiPickField id="project-techs" options={techOptions(techs)} value={field.value} onChange={field.onChange} invalid={Boolean(fieldState.error)} emptyText={emptyHint("technologies", "tech-stacks")} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="traffic"
            render={({ field, fieldState }) => (
              <Field className="mt-5" label="Monthly traffic" required error={fieldState.error?.message} hint="Monthly users, as a range.">
                <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {TRAFFIC.map((t, i) => {
                    const checked = field.value === t.value;
                    return (
                      <label key={t.value} className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center text-xs transition-colors ${checked ? "border-accent/70 bg-accent/[0.08] text-fg" : "border-line text-muted hover:border-line-strong"}`}>
                        <input type="radio" name="traffic" value={t.value} checked={checked} onChange={() => field.onChange(t.value)} className="sr-only" />
                        <span className="flex h-4 items-end gap-0.5" aria-hidden>
                          {TRAFFIC.map((_, bar) => (
                            <span key={bar} className={`w-1 rounded-sm ${bar <= i ? (checked ? "bg-accent" : "bg-muted") : "bg-tint/15"}`} style={{ height: `${4 + bar * 2.4}px` }} />
                          ))}
                        </span>
                        {t.label}
                        {checked && <LuCheck className="size-3.5 text-accent" />}
                      </label>
                    );
                  })}
                </div>
              </Field>
            )}
          />
        </Card>

        <Card title="Links" description="Without a live or source link the project is private (NDA): it shows a “private project” note and no media.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Live preview" htmlFor="project-live" error={formState.errors.live_url?.message}>
              <TextInput id="project-live" {...register("live_url", { onChange: onLinkChange })} placeholder="https://" inputMode="url" disabled={isPrivate} invalid={Boolean(formState.errors.live_url)} />
            </Field>
            <Field label="Source code" htmlFor="project-repo" error={formState.errors.repo_url?.message}>
              <TextInput id="project-repo" {...register("repo_url", { onChange: onLinkChange })} placeholder="https://github.com/…" inputMode="url" disabled={isPrivate} invalid={Boolean(formState.errors.repo_url)} />
            </Field>
          </div>
          <div className="mt-4">
            <Checkbox
              label={
                <span className="inline-flex items-center gap-1.5">
                  <LuLock className="size-3.5" /> Private project
                </span>
              }
              description={isPrivate ? "Links and media are locked. Untick to add them." : "Tick when the project is under NDA."}
              checked={isPrivate}
              onChange={(e) => onPrivateChange(e.target.checked)}
            />
            {formState.errors.is_private && <p className="mt-1 text-xs text-danger">{formState.errors.is_private.message}</p>}
          </div>
        </Card>

        <Card title="Gallery" description="Up to 10 images and 2 videos. The star picks the card's cover (default: the first image).">
          <Controller
            control={control}
            name="media"
            render={({ field, fieldState }) => (
              <>
                <MediaGallery
                  value={field.value}
                  onChange={field.onChange}
                  imagePurpose="project_image"
                  videoPurpose="project_video"
                  maxImages={10}
                  maxVideos={2}
                  coverId={coverId}
                  onCoverChange={(id) => setValue("cover_id", id, { shouldDirty: true })}
                  disabled={isPrivate}
                  disabledText="Private projects have no images or videos."
                  invalid={Boolean(fieldState.error)}
                />
                {fieldState.error && <p className="mt-1 text-xs text-danger">{fieldState.error.message}</p>}
                {formState.errors.cover_id && <p className="mt-1 text-xs text-danger">{formState.errors.cover_id.message}</p>}
              </>
            )}
          />
        </Card>

        <SaveBar dirty={formState.isDirty || !item} saving={formState.isSubmitting} error={saveError} onDiscard={() => reset()} label={item ? "Save changes" : "Add project"} />
      </form>
    </FormProvider>
  );
}

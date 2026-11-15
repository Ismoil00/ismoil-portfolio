"use client";

import { useId, useState } from "react";
import { Controller, get, useFormContext, useWatch } from "react-hook-form";
import { LuCheck, LuLanguages } from "react-icons/lu";
import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { LANG_LABELS, LANG_NAMES, LANGS, visibleLength, type I18nText, type Lang } from "@/lib/i18n";
import { inputClass } from "./Field";
import { RichTextEditor } from "./RichTextEditor";

type Kind = "text" | "multiline" | "rich";

/**
 * One text in the site's three languages: EN / RU / TG tabs over a single input.
 * A tab shows a check when filled and a red dot when it has an error. "Translate" fills RU and TG
 * from the English text (Claude API on the backend); you review them before saving.
 */
export function I18nField({
  name,
  label,
  required = false,
  max,
  kind = "text",
  rows = 4,
  placeholder,
  hint,
  translatable = true,
}: {
  name: string;
  label: string;
  required?: boolean;
  max: number;
  kind?: Kind;
  rows?: number;
  placeholder?: string;
  hint?: string;
  translatable?: boolean;
}) {
  const id = useId();
  const toast = useToast();
  const { register, control, setValue, getValues, formState } = useFormContext();
  const value = (useWatch({ control, name }) ?? { en: "", ru: "", tg: "" }) as I18nText;
  const [lang, setLang] = useState<Lang>("en");
  const [translating, setTranslating] = useState(false);

  const rich = kind === "rich";
  const errorOf = (l: Lang): string | undefined =>
    (get(formState.errors, `${name}.${l}`) as { message?: string } | undefined)?.message;
  const filled = (l: Lang) => visibleLength(value[l] ?? "", rich) > 0;
  // The active tab's error first; otherwise the first other tab's, so a hidden problem isn't missed.
  const errorLang = errorOf(lang) ? lang : LANGS.find((l) => errorOf(l));
  const activeError = errorLang ? errorOf(errorLang) : undefined;
  const length = visibleLength(value[lang] ?? "", rich);

  async function translate() {
    const english = getValues(`${name}.en`) as string;
    if (!visibleLength(english ?? "", rich)) {
      toast("Write the English text first.", "error");
      setLang("en");
      return;
    }
    const current = getValues(name) as I18nText;
    if ((filled("ru") || filled("tg")) && !window.confirm("Replace the current Russian and Tajik texts with new translations?")) return;
    setTranslating(true);
    try {
      const { data } = await api.post<{ ru: string; tg: string }>("/admin/translate", {
        text: english,
        format: rich ? "html" : "text",
      });
      for (const target of ["ru", "tg"] as const) {
        setValue(`${name}.${target}`, data[target] ?? current[target], { shouldDirty: true, shouldValidate: true });
      }
      setLang("ru");
      toast("Translated. Check the Russian and Tajik tabs before saving.");
    } catch (error) {
      toast(errorMessage(error, "Couldn't translate right now."), "error");
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`${id}-${lang}`} className="flex items-baseline gap-1 text-sm font-medium text-muted">
          {label}
          {required ? <span className="text-accent" aria-hidden>*</span> : <span className="text-xs text-faint">(optional)</span>}
        </label>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label={`${label} language`} className="flex rounded-full border border-line p-0.5">
            {LANGS.map((l) => {
              const hasError = Boolean(errorOf(l));
              return (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={lang === l}
                  title={LANG_NAMES[l]}
                  onClick={() => setLang(l)}
                  className={`relative flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold tracking-wide transition-colors duration-200 ${
                    lang === l ? "bg-accent text-bg light:text-white" : "text-subtle hover:text-fg"
                  }`}
                >
                  {LANG_LABELS[l]}
                  {hasError ? (
                    <span className="size-1.5 rounded-full bg-danger" aria-label="has an error" />
                  ) : (
                    filled(l) && <LuCheck className={`size-3 ${lang === l ? "" : "text-success"}`} aria-label="filled" />
                  )}
                </button>
              );
            })}
          </div>
          {translatable && (
            <button
              type="button"
              onClick={translate}
              disabled={translating}
              title="Fill Russian and Tajik from the English text"
              className="flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-muted transition-colors duration-200 hover:border-accent/60 hover:text-accent disabled:opacity-60"
            >
              {translating ? <Spinner className="size-3.5" /> : <LuLanguages className="size-3.5" />}
              Translate
            </button>
          )}
        </div>
      </div>

      {LANGS.map((l) => {
        const fieldId = `${id}-${l}`;
        const common = {
          id: fieldId,
          "aria-invalid": Boolean(errorOf(l)) || undefined,
          placeholder: l === "en" ? placeholder : undefined,
          lang: l === "tg" ? "tg" : l,
        };
        return (
          <div key={l} hidden={lang !== l}>
            {rich ? (
              <Controller
                control={control}
                name={`${name}.${l}`}
                render={({ field }) => (
                  <RichTextEditor id={fieldId} value={field.value ?? ""} onChange={field.onChange} invalid={Boolean(errorOf(l))} />
                )}
              />
            ) : kind === "multiline" ? (
              <textarea {...register(`${name}.${l}`)} {...common} rows={rows} className={`${inputClass} resize-y leading-relaxed`} />
            ) : (
              <input {...register(`${name}.${l}`)} {...common} className={inputClass} />
            )}
          </div>
        );
      })}

      <div className="mt-1.5 flex items-start justify-between gap-3 text-xs">
        {activeError && errorLang ? (
          <p role="alert" className="text-danger">
            {LANG_NAMES[errorLang]}: {activeError}
          </p>
        ) : (
          <p className="text-faint">{hint}</p>
        )}
        <span className={`shrink-0 tabular-nums ${length > max ? "text-danger" : "text-faint"}`}>
          {length} / {max}
        </span>
      </div>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { LuSend } from "react-icons/lu";
import { sendContactMessage } from "@/api/contact.actions";

type Status = "idle" | "sending" | "sent" | "error" | "invalid" | "rate-limited";

const inputClass =
  "w-full rounded-xl border border-line bg-bg/60 px-4 py-3 text-fg placeholder:text-faint outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
/** An international number as people type it: +, then digits with spaces, dashes, dots, brackets; 7–15 digits. */
const isPhone = (v: string) => /^\+[\d\s\-().]+$/.test(v) && /^\d{7,15}$/.test(v.replace(/\D/g, ""));

export function ContactForm() {
  const t = useTranslations("contact");
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const payload = {
      name: data.name?.trim(),
      contact: data.contact?.trim(),
      message: data.message?.trim(),
      website: data.website ?? "",
    };

    if (!payload.name || !payload.message || !payload.contact || !(isEmail(payload.contact) || isPhone(payload.contact))) {
      setStatus("invalid");
      return;
    }

    setStatus("sending");
    try {
      const result = await sendContactMessage(payload as Required<typeof payload>);
      setStatus(result);
      if (result === "sent") form.reset();
    } catch {
      setStatus("error");
    }
  };

  const clearInvalid = () => status === "invalid" && setStatus("idle");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-line bg-card p-6 sm:p-8">
      {/* Bot trap: invisible to people and screen readers; form-filling bots fill it in and are ignored. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm text-muted">{t("name")}</span>
          <input name="name" autoComplete="name" maxLength={100} placeholder={t("namePlaceholder")} className={inputClass} onInput={clearInvalid} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-muted">{t("contactField")}</span>
          <input name="contact" autoComplete="email" maxLength={200} placeholder={t("contactPlaceholder")} className={inputClass} onInput={clearInvalid} />
        </label>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm text-muted">{t("message")}</span>
        <textarea name="message" rows={6} maxLength={2000} placeholder={t("messagePlaceholder")} className={`${inputClass} resize-y`} onInput={clearInvalid} />
      </label>

      <div aria-live="polite" className="min-h-5 text-sm">
        {status === "invalid" && <p className="text-red-400 light:text-red-600">{t("required")}</p>}
        {status === "error" && <p className="text-red-400 light:text-red-600">{t("error")}</p>}
        {status === "rate-limited" && <p className="text-red-400 light:text-red-600">{t("rateLimited")}</p>}
        {status === "sent" && <p className="text-emerald-400 light:text-emerald-600">{t("sent")}</p>}
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-3.5 font-display font-medium text-bg transition-colors hover:bg-accent-soft disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? t("sending") : t("send")}
        <LuSend className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </form>
  );
}

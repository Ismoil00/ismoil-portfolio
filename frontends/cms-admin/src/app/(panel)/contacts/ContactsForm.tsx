"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IconType } from "react-icons";
import { LuMail } from "react-icons/lu";
import { SiTelegram, SiWhatsapp } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa6";
import { api } from "@/api/client";
import { Field, TextInput } from "@/components/form/Field";
import { SaveBar } from "@/components/form/SaveBar";
import { applyServerErrors } from "@/components/form/server-errors";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { ContactChannel, Contacts } from "@/types/api";

const PHONE = /^\+[\d\s\-().]{7,30}$/;

const schema = z
  .object({
    email: z.string().trim().max(254).refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email"),
    telegram: z.string().trim().max(64),
    whatsapp: z.string().trim().max(32).refine((v) => v === "" || PHONE.test(v), "Use the international format, like +992 209 538 080"),
    linkedin: z.string().trim().max(2048).refine((v) => v === "" || /linkedin\.com\/in\/[^/\s]+\/?$/i.test(v), "Use your profile link, like https://www.linkedin.com/in/your-name"),
  })
  .superRefine((v, ctx) => {
    if ([v.email, v.telegram, v.whatsapp, v.linkedin].filter(Boolean).length < 2) {
      ctx.addIssue({ code: "custom", path: ["root"], message: "Fill in at least two ways to reach you." });
    }
  });
type Values = z.infer<typeof schema>;

const CHANNELS: { key: ContactChannel; label: string; icon: IconType; color: string; placeholder: string; hint: string }[] = [
  { key: "email", label: "Email", icon: LuMail, color: "var(--color-accent)", placeholder: "you@example.com", hint: "Opens the visitor's mail app." },
  { key: "telegram", label: "Telegram", icon: SiTelegram, color: "#26A5E4", placeholder: "@username or +992 …", hint: "Your username (best) or phone number." },
  { key: "whatsapp", label: "WhatsApp", icon: SiWhatsapp, color: "#25D366", placeholder: "+992 209 538 080", hint: "Phone number with the country code." },
  { key: "linkedin", label: "LinkedIn", icon: FaLinkedinIn, color: "#0A66C2", placeholder: "https://www.linkedin.com/in/your-name", hint: "Your profile link." },
];

const toValues = (c: Contacts | null): Values => ({
  email: c?.email ?? "",
  telegram: c?.telegram ? (c.telegram.startsWith("+") ? c.telegram : `@${c.telegram}`) : "",
  whatsapp: c?.whatsapp ?? "",
  linkedin: c?.linkedin ?? "",
});

export function ContactsForm({ contacts: initial }: { contacts: Contacts | null }) {
  const router = useRouter();
  const toast = useToast();
  const [contacts, setContacts] = useState(initial);
  const methods = useForm<Values>({ defaultValues: toValues(initial), resolver: zodResolver(schema) });
  const { register, handleSubmit, reset, setError, formState } = methods;
  const [saveError, setSaveError] = useState<string | null>(null);
  const rootError = (formState.errors as { root?: { message?: string } }).root?.message;

  async function save(values: Values) {
    setSaveError(null);
    try {
      const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v || null]));
      const { data } = await api.put<Contacts>("/admin/contacts", body);
      setContacts(data);
      reset(toValues(data));
      toast("Contacts saved.");
      router.refresh();
    } catch (error) {
      setSaveError(applyServerErrors(error, setError));
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(save, (e) => setSaveError((e as { root?: { message?: string } }).root?.message ?? "Some fields need attention."))} noValidate>
        <Card title="Ways to reach you" description="At least two. Each one is a tile in the Contact section, an icon in the footer and in the side rail.">
          <div className="grid gap-5 sm:grid-cols-2">
            {CHANNELS.map(({ key, label, icon: Icon, color, placeholder, hint }) => {
              const shown = contacts?.links[key];
              return (
                <Field
                  key={key}
                  label={
                    <span className="inline-flex items-center gap-2">
                      <Icon className="size-4" style={{ color }} aria-hidden /> {label}
                    </span>
                  }
                  htmlFor={`contact-${key}`}
                  error={formState.errors[key]?.message}
                  hint={shown ? `On the site: ${shown.handle}` : hint}
                >
                  <TextInput id={`contact-${key}`} {...register(key)} placeholder={placeholder} invalid={Boolean(formState.errors[key] || rootError)} autoComplete="off" />
                </Field>
              );
            })}
          </div>
        </Card>
        <SaveBar dirty={formState.isDirty} saving={formState.isSubmitting} error={saveError ?? rootError ?? null} onDiscard={() => reset()} />
      </form>
    </FormProvider>
  );
}

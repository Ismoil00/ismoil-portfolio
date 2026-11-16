"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { errorMessage, fieldErrors } from "@/api/errors";
import { RadioCards, type RadioCardOption } from "@/components/form/Choice";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { PanelSettings, Translator } from "@/types/api";

/** Which helper fills Russian and Tajik from English. Saved as soon as one is picked. */
export function TranslatorCard({ settings }: { settings: PanelSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState<Translator>(settings.translator);
  const [saving, setSaving] = useState(false);

  const options: RadioCardOption<Translator>[] = [
    {
      value: "google_web",
      label: "Google Translate",
      badge: "Free",
      description: "RU and TG buttons next to each field open translate.google.com with your English text in a new tab. Paste the result back. No key, no card.",
    },
    {
      value: "manual",
      label: "Manual",
      badge: "Free",
      description: "No helper button: you type the Russian and Tajik texts yourself.",
    },
    {
      value: "claude",
      label: "Claude",
      badge: settings.claude_ready ? "Paid" : "Not set up",
      disabled: !settings.claude_ready,
      description: "A Translate button fills the RU and TG tabs for you to review. Uses the Anthropic API, paid by usage.",
    },
  ];

  async function choose(next: Translator) {
    if (next === value || saving) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const { data } = await api.put<PanelSettings>("/admin/settings", { translator: next });
      setValue(data.translator);
      toast("Translator saved.");
      router.refresh(); // the EN / RU / TG fields read it from the panel layout
    } catch (error) {
      setValue(previous);
      toast(fieldErrors(error).translator ?? errorMessage(error, "Couldn't save the translator."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Translation" description="What helps you fill the Russian and Tajik tabs from the English text. Saved as soon as you pick one.">
      <RadioCards name="translator" options={options} value={value} onChange={choose} />
      {!settings.claude_ready && (
        <p className="mt-4 text-xs text-subtle">
          {value === "claude" ? (
            <span className="text-danger">Claude is chosen, but its key is missing, so Translate will fail. </span>
          ) : null}
          To use Claude, add <code className="text-fg">ANTHROPIC_API_KEY</code> to <code className="text-fg">backend/.env</code> and restart the backend.
        </p>
      )}
    </Card>
  );
}

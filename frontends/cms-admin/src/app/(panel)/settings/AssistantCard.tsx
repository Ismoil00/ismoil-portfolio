"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { errorMessage, fieldErrors } from "@/api/errors";
import { Checkbox } from "@/components/form/Choice";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { PanelSettings } from "@/types/api";

/** The public site's AI assistant: on or off. It can be switched on only once GROQ_API_KEY is set. */
export function AssistantCard({ settings }: { settings: PanelSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [enabled, setEnabled] = useState(settings.assistant_enabled);
  const [saving, setSaving] = useState(false);

  async function save(next: boolean) {
    if (saving) return;
    setEnabled(next);
    setSaving(true);
    try {
      const { data } = await api.put<PanelSettings>("/admin/settings", { assistant_enabled: next });
      setEnabled(data.assistant_enabled);
      toast(data.assistant_enabled ? "AI assistant switched on." : "AI assistant switched off.");
      router.refresh();
    } catch (error) {
      setEnabled(!next);
      toast(fieldErrors(error).assistant_enabled ?? errorMessage(error, "Couldn't save the AI assistant setting."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="AI assistant"
      description="A chat on the public site that answers visitors' questions from your content (projects, experience, skills). It runs on Groq's free tier: at its limits it pauses, it never bills."
    >
      <Checkbox
        label="Show the AI assistant on the public site"
        description={settings.assistant_ready ? "Ready: the Groq key is set." : "Not set up: the Groq key is missing."}
        checked={enabled}
        disabled={saving || (!settings.assistant_ready && !enabled)}
        blockedReason={settings.assistant_ready ? undefined : "Add GROQ_API_KEY to the backend first"}
        onChange={(e) => save(e.target.checked)}
      />
      {!settings.assistant_ready && (
        <p className="mt-4 text-xs text-subtle">
          To use it, add <code className="text-fg">GROQ_API_KEY</code> to <code className="text-fg">backend/.env</code> and
          restart the backend (in production: the backend project&apos;s environment variables on Vercel).
        </p>
      )}
    </Card>
  );
}

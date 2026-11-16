import type { Metadata } from "next";
import { serverGet } from "@/api/server";
import { PageHeader } from "@/components/layout/PageHeader";
import type { PanelSettings } from "@/types/api";
import { PasswordCard } from "./PasswordCard";
import { TranslatorCard } from "./TranslatorCard";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, me] = await Promise.all([
    serverGet<PanelSettings>("/admin/settings"),
    serverGet<{ email: string }>("/auth/me"),
  ]);
  return (
    <>
      <PageHeader title="Settings" description="How the admin panel works for you." />
      <div className="space-y-6">
        <TranslatorCard settings={settings} />
        <PasswordCard email={me.email} />
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { serverGet } from "@/api/server";
import { PageHeader } from "@/components/layout/PageHeader";
import type { Me, PanelSettings } from "@/types/api";
import { AssistantCard } from "./AssistantCard";
import { PasswordCard } from "./PasswordCard";
import { TranslatorCard } from "./TranslatorCard";
import { UsernameCard } from "./UsernameCard";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, me] = await Promise.all([
    serverGet<PanelSettings>("/admin/settings"),
    serverGet<Me>("/auth/me"),
  ]);
  return (
    <>
      <PageHeader title="Settings" description="How the admin panel works for you." />
      <div className="space-y-6">
        <TranslatorCard settings={settings} />
        <AssistantCard settings={settings} />
        <UsernameCard username={me.username} />
        <PasswordCard username={me.username} />
      </div>
    </>
  );
}

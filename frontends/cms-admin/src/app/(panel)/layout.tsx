import type { ReactNode } from "react";
import { serverGet } from "@/api/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { PanelSettingsProvider } from "@/lib/panel-settings";
import type { Me, PanelSettings } from "@/types/api";

/** Every admin page: the backend confirms the session first (an expired one goes to /login). */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const [me, settings] = await Promise.all([
    serverGet<Me>("/auth/me"),
    // Which translator the EN / RU / TG fields offer (Settings page).
    serverGet<PanelSettings>("/admin/settings"),
  ]);

  return (
    <ToastProvider>
      <PanelSettingsProvider value={settings}>
        <div className="min-h-svh lg:pl-64">
          <Sidebar username={me.username} />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 lg:px-10 lg:pt-12">{children}</main>
        </div>
      </PanelSettingsProvider>
    </ToastProvider>
  );
}

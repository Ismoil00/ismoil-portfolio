"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PanelSettings } from "@/types/api";

const DEFAULTS: PanelSettings = {
  translator: "manual",
  claude_ready: false,
  assistant_enabled: false,
  assistant_ready: false,
};
const PanelSettingsContext = createContext<PanelSettings>(DEFAULTS);

/** The admin panel's own settings, loaded once per page by the panel layout. */
export function PanelSettingsProvider({ value, children }: { value: PanelSettings; children: ReactNode }) {
  return <PanelSettingsContext.Provider value={value}>{children}</PanelSettingsContext.Provider>;
}

export const usePanelSettings = () => useContext(PanelSettingsContext);

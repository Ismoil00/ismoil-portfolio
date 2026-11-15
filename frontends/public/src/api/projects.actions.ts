"use server";

import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import type { ProjectQuery, ProjectsPage } from "@/types/content";
import { getProjectsPage } from "./projects.api";
import { cleanList, cleanMonth, cleanPaging } from "./query-guards";

/** Server Action the projects page calls for "Show more" and filter changes (see experience.actions.ts). */
export async function loadProjectsPage(locale: string, query: ProjectQuery): Promise<ProjectsPage> {
  if (!hasLocale(routing.locales, locale)) throw new Error("Unsupported locale");
  return getProjectsPage(locale, {
    ...cleanPaging(query),
    clients: cleanList(query?.clients),
    stack: cleanList(query?.stack),
    types: cleanList(query?.types),
    from: cleanMonth(query?.from),
    to: cleanMonth(query?.to),
  });
}

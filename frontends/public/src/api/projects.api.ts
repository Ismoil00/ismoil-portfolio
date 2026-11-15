import "server-only";
import { isAxiosError } from "axios";
import type { Locale } from "@/i18n/routing";
import type { Project, ProjectFilterOptions, ProjectQuery, ProjectsPage } from "@/types/content";
import { apiGet } from "./client";
import { endpoints } from "./endpoints";

/** Query params in the shape the backend expects (repeated keys for lists: ?type=a&type=b). */
function toParams(locale: Locale, q: ProjectQuery) {
  const params = new URLSearchParams({ lang: locale, offset: String(q.offset), limit: String(q.limit) });
  q.clients?.forEach((v) => params.append("client", v));
  q.stack?.forEach((v) => params.append("stack", v));
  q.types?.forEach((v) => params.append("type", v));
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  return params;
}

/** One page of project cards (newest first), filtered. */
export const getProjectsPage = (locale: Locale, q: ProjectQuery) =>
  apiGet<ProjectsPage>(endpoints.projects, toParams(locale, q));

/** Clients, technologies, product types and date bounds that the filters can offer. */
export const getProjectFilterOptions = (locale: Locale) =>
  apiGet<ProjectFilterOptions>(endpoints.projectFilters, { lang: locale });

/** Every project slug — for the sitemap. */
export const getProjectSlugs = () => apiGet<string[]>(endpoints.projectSlugs);

/** One project for its page, or null when it doesn't exist (→ 404). */
export async function getProject(locale: Locale, slug: string): Promise<Project | null> {
  try {
    return await apiGet<Project>(endpoints.project(slug), { lang: locale });
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

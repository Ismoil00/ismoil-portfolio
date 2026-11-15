import "server-only";
import type { Locale } from "@/i18n/routing";
import type { Profile, Skills } from "@/types/content";
import { apiGet } from "./client";
import { endpoints } from "./endpoints";

/** Hero, About, contacts, other links and the counted stats, in one language. */
export const getProfile = (locale: Locale) => apiGet<Profile>(endpoints.profile, { lang: locale });

/** The Tech stack section: activated filters and technologies, in order. */
export const getSkills = (locale: Locale) => apiGet<Skills>(endpoints.skills, { lang: locale });
// Experience, projects, certificates, testimonials: ./<name>.api.ts

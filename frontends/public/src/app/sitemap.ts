import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import { getProjectSlugs } from "@/api/projects.api";
import { getTestimonialsPage } from "@/api/testimonials.api";

// Built from the backend's current content on each request (not at build time).
export const dynamic = "force-dynamic";

type Page = { path: string; priority: number; changeFrequency: "monthly" | "yearly" };

/** Every public page in every language, with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, testimonials] = await Promise.all([
    getProjectSlugs(),
    getTestimonialsPage(routing.defaultLocale, { offset: 0, limit: 1 }),
  ]);
  const pages: Page[] = [
    { path: "", priority: 1, changeFrequency: "monthly" },
    { path: "/experience", priority: 0.8, changeFrequency: "monthly" },
    { path: "/projects", priority: 0.8, changeFrequency: "monthly" },
    { path: "/certificates", priority: 0.7, changeFrequency: "monthly" },
    // Only once there is at least one testimonial (the page is a 404 until then).
    ...(testimonials.total > 0 ? [{ path: "/testimonials", priority: 0.7, changeFrequency: "monthly" as const }] : []),
    ...slugs.map((slug) => ({ path: `/projects/${slug}`, priority: 0.7, changeFrequency: "yearly" as const })),
  ];

  return pages.flatMap(({ path, priority, changeFrequency }) => {
    const languages = Object.fromEntries(routing.locales.map((l) => [l, `${siteUrl}/${l}${path}`]));
    return routing.locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency,
      priority: locale === routing.defaultLocale ? priority : priority - 0.1,
      alternates: { languages },
    }));
  });
}

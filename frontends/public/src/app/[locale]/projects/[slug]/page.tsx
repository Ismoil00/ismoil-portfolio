import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LuArrowLeft, LuArrowUpRight } from "react-icons/lu";
import { trafficRanges, type TrafficRange } from "@/types/content";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getProject } from "@/api/projects.api";
import { getProfile } from "@/api/content.api";
import { Container } from "@/components/ui/Container";
import { TechChip } from "@/components/tech/TechChip";
import { ProjectLinks } from "@/components/projects/ProjectLinks";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { currentMonth, formatDuration, formatMonth, monthsBetween } from "@/lib/dates";
import { siteUrl } from "@/lib/site";
import { ProjectGallery } from "./_components/ProjectGallery";

// Rendered on each request (see the [locale] layout), so edits in the admin panel show at once.
type Props = { params: Promise<{ locale: string; slug: string }> };

/** Only real files/URLs can be used for link previews. */
const isShareable = (src?: string | null): src is string => Boolean(src && (src.startsWith("http") || src.startsWith("/")));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const [project, t] = await Promise.all([
    getProject(locale, slug),
    getTranslations({ locale, namespace: "projectPage" }),
  ]);
  if (!project) return {};

  const title = t("metaTitle", { name: project.title });
  const image = project.cover?.type === "video" ? project.cover.poster : project.cover?.src;
  return {
    title,
    description: project.summary,
    alternates: {
      canonical: `/${locale}/projects/${slug}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/projects/${slug}`])),
    },
    openGraph: {
      type: "article",
      title,
      description: project.summary,
      url: `/${locale}/projects/${slug}`,
      images: isShareable(image) ? [{ url: image }] : undefined,
    },
  };
}

/** /[locale]/projects/[slug] — one project in detail. */
export default async function ProjectPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const [project, profile, t, tx, tr] = await Promise.all([
    getProject(locale, slug),
    getProfile(locale),
    getTranslations({ locale, namespace: "projectPage" }),
    getTranslations({ locale, namespace: "experience" }),
    getTranslations({ locale, namespace: "traffic" }),
  ]);
  if (!project) notFound();

  const monthNames = tx.raw("months") as string[];
  const period = `${formatMonth(project.start, monthNames)} — ${project.end ? formatMonth(project.end, monthNames) : tx("present")}`;
  const duration = formatDuration(monthsBetween(project.start, project.end ?? currentMonth()), (k, v) => tx(k, v));

  // Structured data so search engines understand the page is a work by this person.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    url: `${siteUrl}/${locale}/projects/${project.id}`,
    dateCreated: project.start,
    ...(project.end ? { dateModified: project.end } : {}),
    inLanguage: locale,
    keywords: project.stack.map((s) => s.name).join(", "),
    author: { "@type": "Person", name: profile.fullName, url: `${siteUrl}/${locale}` },
    ...(project.client.name ? { funder: { "@type": "Organization", name: project.client.name } } : {}),
    ...(project.liveUrl ? { sameAs: project.liveUrl } : {}),
    ...(project.repoUrl ? { codeRepository: project.repoUrl } : {}),
  };

  return (
    <article className="pb-24 pt-28 sm:pt-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Container>
        <Link
          href="/projects"
          className="group mb-8 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-accent"
        >
          <LuArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden />
          {t("back")}
        </Link>

        {/* 1. Name */}
        <h1 className="animate-fade-up font-display text-[clamp(2.25rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-balance">
          <span className="bg-gradient-to-r from-fg via-accent-soft to-accent bg-clip-text text-transparent">
            {project.title}
          </span>
        </h1>

        {/* 2. Gallery */}
        {project.media.length > 0 && (
          <div className="mt-10 animate-fade-up [animation-delay:100ms]">
            <ProjectGallery media={project.media} title={project.title} />
          </div>
        )}

        {/* 3. Live preview / source code (or the NDA note) */}
        <div className="mt-8 animate-fade-up [animation-delay:150ms]">
          <ProjectLinks repoUrl={project.repoUrl} liveUrl={project.liveUrl} variant="buttons" />
        </div>

        {/* 4–6. Product type · Period · Client · Monthly traffic, then the full tech stack */}
        <dl className="mt-12 grid gap-x-8 gap-y-9 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label={t("type")}>
            <ul className="flex flex-wrap gap-2">
              {project.types.map((type) => (
                <li
                  key={type.id}
                  className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-strong/10 px-3 py-1.5 text-sm text-accent-soft"
                >
                  {type.icon && <SvgIcon svg={type.icon} className="size-4" />}
                  {type.title}
                </li>
              ))}
            </ul>
          </Fact>
          <Fact label={t("period")}>
            <p className="font-display text-fg">{period}</p>
            <p className="mt-1 text-sm text-subtle">{duration}</p>
          </Fact>
          {/* Built for someone else (company or person) or self-initiated — nothing more specific. */}
          <Fact label={t("client")}>
            {project.client.name && project.client.url ? (
              <a
                href={project.client.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/client inline-flex items-center gap-1.5 font-display text-fg transition-colors hover:text-accent"
              >
                {project.client.name}
                <LuArrowUpRight
                  className="size-4 text-subtle transition-[color,translate] group-hover/client:-translate-y-0.5 group-hover/client:translate-x-0.5 group-hover/client:text-accent"
                  aria-hidden
                />
              </a>
            ) : (
              <p className="font-display text-fg">
                {project.client.kind === "self"
                  ? t("clientSelf")
                  : (project.client.name ?? t("clientPrivate"))}
              </p>
            )}
          </Fact>
          {project.traffic && (
            <Fact label={t("traffic")}>
              <div className="flex items-center gap-3">
                <TrafficMeter range={project.traffic} />
                <p className="font-display text-fg">{tr(project.traffic)}</p>
              </div>
            </Fact>
          )}
          <Fact label={t("stack")} wide>
            <ul className="flex flex-wrap gap-2">
              {project.stack.map((s) => (
                <TechChip key={s.id} tech={s} size="md" />
              ))}
            </ul>
          </Fact>
        </dl>

        {/* 7. Description */}
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="font-display text-[11px] uppercase tracking-[0.18em] text-subtle">{t("about")}</h2>
          {/* Sanitized by the backend (allow-list) when it was saved in the admin. */}
          <div className="rich-text mt-4 max-w-3xl text-lg leading-relaxed text-muted" dangerouslySetInnerHTML={{ __html: project.description }} />
        </section>
      </Container>
    </article>
  );
}

/** Six bars, lit up to the traffic range (under 100 … over 1 million). */
function TrafficMeter({ range }: { range: TrafficRange }) {
  const level = trafficRanges.indexOf(range);
  return (
    <span aria-hidden className="flex h-5 shrink-0 items-end gap-[3px]">
      {trafficRanges.map((r, i) => (
        <span
          key={r}
          className={`w-1 rounded-full ${i <= level ? "bg-gradient-to-t from-accent-strong to-accent" : "bg-line-strong"}`}
          style={{ height: `${30 + i * 14}%` }}
        />
      ))}
    </span>
  );
}

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-4" : ""}>
      <dt className="mb-3 font-display text-[11px] uppercase tracking-[0.18em] text-subtle">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

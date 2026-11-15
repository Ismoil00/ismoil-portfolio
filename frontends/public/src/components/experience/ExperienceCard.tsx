import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LuFolderOpen, LuQuote } from "react-icons/lu";
import type { Experience } from "@/types/content";
import { Link } from "@/i18n/navigation";
import { Spotlight } from "@/components/ui/Spotlight";
import { TechChip } from "@/components/tech/TechChip";
import { currentMonth, formatDuration, formatMonth, monthsBetween } from "@/lib/dates";

/**
 * One experience card — used on the home page and on /experience.
 * "Key projects" open each project's own page; "Testimonials" open the testimonials page
 * scrolled to that testimonial (it loads more pages until it's there).
 */
export function ExperienceCard({ item }: { item: Experience }) {
  const t = useTranslations("experience");
  const monthNames = t.raw("months") as string[];

  const duration = formatDuration(monthsBetween(item.start, item.end ?? currentMonth()), (k, v) => t(k, v));
  const { company } = item;

  return (
    <article data-flash-target className="rounded-2xl">
      <Spotlight
        reactiveShadow
        size={210}
        shadowScale={0.7}
        intensity={0.7}
        className="rounded-2xl border border-line bg-card hover:border-accent/40"
      >
        <div className="p-6 sm:p-8">
          <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold sm:text-2xl">{item.role}</h3>

              {/* Logo sits after the name, so names line up whether or not a logo exists. */}
              <p className="mt-1 flex items-center gap-2 font-display text-accent">
                {company.url ? (
                  <a
                    href={company.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("companySite", { company: company.name })}
                    className="underline-offset-4 transition-colors hover:text-accent-soft hover:underline"
                  >
                    {company.name}
                  </a>
                ) : (
                  <span>{company.name}</span>
                )}
                {company.logo && (
                  // Logos come from the admin panel (any host), so a plain <img> is used.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logo}
                    alt=""
                    loading="lazy"
                    className="h-5 w-auto max-w-20 rounded-sm object-contain"
                  />
                )}
              </p>

            </div>

            <div className="shrink-0 md:text-right">
              <p className="font-display text-sm text-fg/85">
                {formatMonth(item.start, monthNames)} — {item.end ? formatMonth(item.end, monthNames) : t("present")}
              </p>
              <p className="mt-0.5 text-xs text-subtle">{duration}</p>
            </div>
          </header>

          {/* Sanitized on the server (allow-listed tags only) when it's saved in the admin panel. */}
          <div className="rich-text mt-5 text-muted" dangerouslySetInnerHTML={{ __html: item.description }} />

          {(item.stack.length > 0 || item.projects.length > 0 || item.testimonials.length > 0) && (
            <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-[max-content_minmax(0,1fr)]">
              {/* Invisible copy of every label: the label column becomes exactly as wide as the
                  longest label of the current language, so values sit close to their labels and
                  still line up across all cards — whichever rows a card has. */}
              <span aria-hidden className="invisible hidden h-0 overflow-hidden sm:col-start-1 sm:row-start-1 sm:block">
                {[t("stack"), t("projects"), t("testimonials")].map((label) => (
                  <span key={label} className={`block whitespace-nowrap ${labelClass}`}>
                    {label}:
                  </span>
                ))}
              </span>
              {item.stack.length > 0 && (
                <Row label={t("stack")} row={1}>
                  <ul className="flex flex-wrap gap-2">
                    {item.stack.map((s) => (
                      <TechChip key={s.id} tech={s} />
                    ))}
                  </ul>
                </Row>
              )}
              {item.projects.length > 0 && (
                <Row label={t("projects")} row={item.stack.length > 0 ? 2 : 1}>
                  <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {item.projects.map((p) => (
                      <li key={p.id}>
                        <CrossLink
                          href={`/projects/${p.id}`}
                          localized
                          label={t("openProject", { name: p.title })}
                          icon={<LuFolderOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />}
                        >
                          {p.title}
                        </CrossLink>
                      </li>
                    ))}
                  </ul>
                </Row>
              )}
              {item.testimonials.length > 0 && (
                <Row
                  label={t("testimonials")}
                  row={1 + Number(item.stack.length > 0) + Number(item.projects.length > 0)}
                >
                  <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {item.testimonials.map((r) => (
                      <li key={r.id}>
                        <CrossLink
                          href={`/testimonials#testimonial-${r.id}`}
                          localized
                          label={t("openTestimonial", { name: r.title })}
                          icon={<LuQuote className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />}
                        >
                          {r.title}
                        </CrossLink>
                      </li>
                    ))}
                  </ul>
                </Row>
              )}
            </dl>
          )}
        </div>
      </Spotlight>
    </article>
  );
}

const labelClass = "font-display text-[11px] uppercase tracking-[0.18em]";

/** Grid rows are placed explicitly (from sm up) so the invisible label sizer can share row 1. */
const rowStart = ["", "sm:row-start-1", "sm:row-start-2", "sm:row-start-3"];

/** "LABEL:  value" — label in the first column, value right after it. */
function Row({ label, row, children }: { label: string; row: number; children: ReactNode }) {
  return (
    <>
      <dt className={`pt-1 text-subtle sm:col-start-1 ${rowStart[row]} ${labelClass}`}>{label}:</dt>
      <dd className={`min-w-0 sm:col-start-2 ${rowStart[row]}`}>{children}</dd>
    </>
  );
}

/**
 * Link styled like "Download resume": icon + underlined text, turns blue on hover, presses in on click.
 * `localized` = a page of the site (gets the /<locale> prefix); otherwise a plain href (#anchor).
 */
function CrossLink({
  href,
  label,
  icon,
  children,
  localized = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
  localized?: boolean;
}) {
  const className =
    "group/link inline-flex items-start gap-2 rounded-md text-sm text-muted transition-[color,transform,translate,scale] duration-200 hover:text-accent active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";
  const content = (
    <>
      {icon}
      <span className="underline decoration-tint/30 underline-offset-4 transition-colors group-hover/link:decoration-accent">
        {children}
      </span>
    </>
  );
  return localized ? (
    <Link href={href} aria-label={label} className={className}>
      {content}
    </Link>
  ) : (
    <a href={href} aria-label={label} className={className}>
      {content}
    </a>
  );
}

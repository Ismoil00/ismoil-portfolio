import { useTranslations } from "next-intl";
import { LuArrowUpRight, LuCalendar, LuFolderOpen, LuLandmark } from "react-icons/lu";
import type { Testimonial } from "@/types/content";
import { Link } from "@/i18n/navigation";
import { Spotlight } from "@/components/ui/Spotlight";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatMonthNumeric } from "@/lib/dates";
import { TestimonialMedia } from "./TestimonialMedia";
import { ExpandableQuote } from "./ExpandableQuote";

const labelClass = "font-display text-[11px] uppercase tracking-[0.18em] text-subtle";
/** One style for the author's role, my position and the project name (the project is also underlined). */
const detailClass = "text-sm font-normal not-italic text-muted";

/**
 * Testimonial card — used on the home page and on /testimonials.
 * Same frame as the project/certificate cards: photo or video on top, then
 * date (month.year) · "Author · Role" · company · my position there · the quote (2 lines,
 * "Read all") · the project it's about · "Verify testimony" (any public link of the author).
 * The project link and the verify button sit at the bottom, aligned across a row.
 * `id="testimonial-<id>"` lets experience cards link straight to it.
 */
export function TestimonialCard({ item }: { item: Testimonial }) {
  const t = useTranslations("testimonials");

  return (
    <article id={`testimonial-${item.id}`} data-flash-target className="anchor-target h-full rounded-2xl">
      <Spotlight
        reactiveShadow
        size={210}
        shadowScale={0.7}
        intensity={0.7}
        className="h-full rounded-2xl border border-line bg-card hover:border-accent/40"
        contentClassName="flex h-full flex-col"
      >
        <div className="relative h-48 shrink-0 overflow-hidden border-b border-line bg-bg sm:h-52">
          <TestimonialMedia media={item.media} author={item.author} />
        </div>

        <div className="flex flex-1 flex-col p-6">
          <p className="flex items-center gap-2 font-display text-sm tabular-nums text-subtle">
            <LuCalendar className="size-3.5 shrink-0" aria-hidden />
            {formatMonthNumeric(item.date)}
          </p>
          {/* "Name · Role". The dot belongs to the role and sits vertically centered. When the
              role doesn't fit and moves to the next line, its dot falls outside the box
              (-ml-5 + overflow-hidden) and is clipped, so no line starts or ends with a dot. */}
          <div className="mt-2 flex flex-wrap items-baseline overflow-hidden">
            <h3 className="mr-5 font-display text-xl font-semibold leading-snug">{item.author}</h3>
            <p className={`relative -ml-5 pl-5 ${detailClass} before:absolute before:left-2 before:top-1/2 before:size-1 before:-translate-y-1/2 before:rounded-full before:bg-subtle`}>
              <span className="sr-only">, </span>
              {item.role}
            </p>
          </div>
          <p className="mt-2 flex items-start gap-2 font-display text-accent">
            <LuLandmark className="mt-1 size-4 shrink-0" aria-hidden />
            {item.company.url ? (
              <a
                href={item.company.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 transition-colors hover:text-accent-soft hover:underline"
              >
                {item.company.name}
              </a>
            ) : (
              item.company.name
            )}
          </p>
          {item.myPosition && (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className={labelClass}>{t("myPosition")}:</span>
              <span className={detailClass}>{item.myPosition}</span>
            </p>
          )}
          {item.quote && <ExpandableQuote text={item.quote} />}

          <div className="mt-auto pt-5">
            {item.projects.length > 0 && (
              <div className="mb-5 flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
                <span className={labelClass}>{t("project", { count: item.projects.length })}:</span>
                {item.projects.map((project) => (
                  <ProjectLink key={project.href} project={project} />
                ))}
              </div>
            )}
            <div className="flex min-h-14 items-center justify-center border-t border-line pt-4">
              <VerifyLink url={item.verifyUrl} />
            </div>
          </div>
        </div>
      </Spotlight>
    </article>
  );
}

/** One of my projects → its page. */
function ProjectLink({ project }: { project: Testimonial["projects"][number] }) {
  const className =
    `group/link inline-flex items-start gap-1.5 rounded-md ${detailClass} transition-[color,transform,translate,scale] duration-200 hover:text-accent active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent`;
  const text = (
    <span className="underline decoration-tint/30 underline-offset-4 transition-colors group-hover/link:decoration-accent">
      {project.title}
    </span>
  );
  return (
    <Link href={project.href} className={className}>
      <LuFolderOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      {text}
    </Link>
  );
}

/** "Verify testimony ↗" — opens any public link of the author (LinkedIn, Telegram, portfolio…). */
function VerifyLink({ url }: { url?: string }) {
  const t = useTranslations("testimonials");
  const base =
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-display text-sm transition-[color,background-color,border-color,transform,translate,scale] duration-200";

  if (!url) {
    return (
      <Tooltip label={t("verifyUnavailable")} align="center">
        <button
          type="button"
          aria-disabled="true"
          aria-label={t("verifyUnavailable")}
          className={`${base} border-dashed border-line text-faint`}
        >
          {t("verify")}
          <LuArrowUpRight className="size-3.5" aria-hidden />
        </button>
      </Tooltip>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t("verify")} — ${t("verifyHint")}`}
      className={`group/verify ${base} border-accent/40 text-accent hover:border-accent hover:bg-accent/10 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      {t("verify")}
      <LuArrowUpRight
        className="size-3.5 transition-transform group-hover/verify:-translate-y-0.5 group-hover/verify:translate-x-0.5"
        aria-hidden
      />
    </a>
  );
}

import { useTranslations } from "next-intl";
import type { IconRef, ProjectSummary } from "@/types/content";
import { Link } from "@/i18n/navigation";
import { Spotlight } from "@/components/ui/Spotlight";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { Tooltip } from "@/components/ui/Tooltip";
import { TechChip } from "@/components/tech/TechChip";
import { ProjectCover } from "./ProjectCover";
import { ProjectLinks } from "./ProjectLinks";
import { ProjectCoverButton } from "./ProjectCoverButton";

/** Extra product types shown as icons after the first one, before the rest collapse into "+N". */
const MAX_ICONS = 3;

/**
 * Project card — used on the home page and on /projects. The whole card opens the project page,
 * except one button on the cover: play (video cover) or expand (image cover) opens it full size.
 *
 * Layout: edge-to-edge thumbnail (fixed height, centered crop) with the order number on it,
 * then product type + release year, the title, up to 3 technologies, a divider, and the
 * code/preview links (or the NDA note).
 * The title link is stretched over the whole card with ::after, so the card is one big link
 * while the GitHub/preview links inside stay real, separate links (no nested <a>).
 * Hover: the same mouse-follow light + shadow as the other cards, and a custom hand cursor.
 */
export function ProjectCard({ project, index }: { project: ProjectSummary; index: number }) {
  const t = useTranslations("projects");

  return (
    <article className="h-full">
      <Spotlight
        reactiveShadow
        size={210}
        shadowScale={0.7}
        intensity={0.7}
        className="cursor-hand group/card h-full rounded-2xl border border-line bg-card hover:border-accent/40"
        contentClassName="flex h-full flex-col"
      >
        <div className="relative h-48 shrink-0 overflow-hidden border-b border-line bg-bg sm:h-52">
          <ProjectCover cover={project.cover} types={project.types} />
          {/* Soft shade in the corner so the number stays readable on any image. Without an image
              (the light placeholder of the light theme) it isn't needed: a soft blue number instead. */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgb(8_10_15/0.75),transparent_42%)] ${
              project.cover ? "" : "light:hidden"
            }`}
          />
          <span
            aria-hidden
            className={`absolute left-5 top-3 font-display text-5xl font-bold text-white/45 transition-colors duration-300 [text-shadow:0_2px_14px_rgb(0_0_0/0.5)] group-hover/card:text-accent/80 ${
              project.cover ? "" : "light:text-accent/25 light:[text-shadow:none]"
            }`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          {project.cover && (
            <ProjectCoverButton
              cover={project.cover}
              title={project.title}
              label={t(project.cover.type === "video" ? "playVideo" : "openImage", { name: project.title })}
            />
          )}
        </div>

        <div className="flex flex-1 flex-col p-6">
          {/* Product type (left) · release year = year of the end date (right) */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <TypeChips types={project.types} />
            <span className="shrink-0 font-display text-sm tabular-nums text-subtle">
              {project.end ? project.end.slice(0, 4) : t("inDevelopment")}
            </span>
          </div>

          <h3 className="font-display text-xl font-semibold leading-snug">
            <Link
              href={`/projects/${project.id}`}
              aria-label={t("open", { name: project.title })}
              className="outline-none transition-colors duration-200 after:absolute after:inset-0 after:rounded-2xl group-hover/card:text-accent-soft focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
            >
              {project.title}
            </Link>
          </h3>

          {/* Bottom block, pinned to the card's bottom edge: up to 3 technologies sit right above
              the divider whatever the title's length, so chips and lines align across a row. */}
          <div className="mt-auto pt-3">
            {project.stack.length > 0 && (
              <ul className="mb-5 flex flex-wrap gap-1.5">
                {project.stack.slice(0, 3).map((s) => (
                  <TechChip key={s.id} tech={s} />
                ))}
              </ul>
            )}
            {/* Same height for icons and the NDA note, so the divider lines up too. */}
            <div className="flex min-h-14 items-center border-t border-line pt-4">
              <div className="w-full">
                <ProjectLinks repoUrl={project.repoUrl} liveUrl={project.liveUrl} variant="icons" />
              </div>
            </div>
          </div>
        </div>
      </Spotlight>
    </article>
  );
}

/**
 * Product types on one line: the first with its name, the others as icon-only chips (hover or
 * focus shows the name), and past MAX_ICONS a "+N" chip listing the rest. Long names in
 * Russian/Tajik ("Кроссплатформенное") therefore never wrap the row.
 */
function TypeChips({ types }: { types: IconRef[] }) {
  const [first, ...others] = types;
  // A type without an icon can't be an icon chip: it joins the "+N" list instead.
  const icons = others.filter((type) => type.icon).slice(0, MAX_ICONS);
  const rest = others.filter((type) => !icons.includes(type));
  const chip = "rounded-full border border-accent/25 bg-accent-strong/10 text-[11px] leading-4 text-accent-soft";

  return (
    <ul className="flex min-w-0 items-center gap-1.5">
      {first && (
        <li className={`inline-flex min-w-0 items-center gap-1 px-2 py-0.5 ${chip}`}>
          {first.icon && <SvgIcon svg={first.icon} className="size-3" />}
          <span className="truncate">{first.title}</span>
        </li>
      )}
      {icons.map((type) => (
        <li key={type.id} className="flex shrink-0">
          <Tooltip label={type.title} align="center" className="z-10">
            <span
              tabIndex={0}
              aria-label={type.title}
              className={`inline-flex size-[22px] items-center justify-center outline-none focus-visible:border-accent ${chip}`}
            >
              <SvgIcon svg={type.icon!} className="size-3" />
            </span>
          </Tooltip>
        </li>
      ))}
      {rest.length > 0 && (
        <li className="flex shrink-0">
          {/* One type per line keeps the bubble narrow, so it never sticks out of the card. */}
          <Tooltip label={rest.map((type) => type.title).join("\n")} align="center" className="z-10">
            <span
              tabIndex={0}
              aria-label={rest.map((type) => type.title).join(", ")}
              className={`inline-flex h-[22px] items-center px-1.5 outline-none focus-visible:border-accent ${chip}`}
            >
              +{rest.length}
            </span>
          </Tooltip>
        </li>
      )}
    </ul>
  );
}

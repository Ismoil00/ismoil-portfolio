import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LuExternalLink, LuLock } from "react-icons/lu";
import { SiGithub } from "react-icons/si";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Source code + live preview of a project, in one of three states:
 *  1. neither link → the NDA note (code and demo can't be shared);
 *  2. preview only → GitHub is shown disabled ("not open-source"), preview opens the project;
 *  3. both         → both open in a new tab.
 * (Code without a preview — e.g. a CLI tool — works the same way the other way round.)
 *
 * `icons`: round icon buttons for cards · `buttons`: labelled buttons for the project page.
 * Links sit above the card's full-size link (`relative z-10`), so they stay clickable.
 */
export function ProjectLinks({
  repoUrl,
  liveUrl,
  variant,
}: {
  repoUrl?: string | null;
  liveUrl?: string | null;
  variant: "icons" | "buttons";
}) {
  const t = useTranslations("projects");

  if (!repoUrl && !liveUrl) {
    return variant === "icons" ? (
      <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
        <LuLock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("confidential")}
      </p>
    ) : (
      <p className="flex items-start gap-3 rounded-2xl border border-line bg-card px-5 py-4 text-sm leading-relaxed text-muted">
        <LuLock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        {t("confidential")}
      </p>
    );
  }

  const code = {
    href: repoUrl,
    label: t("code"),
    hint: repoUrl ? t("codeHint") : t("codeClosed"),
    icon: <SiGithub className="size-4" aria-hidden />,
  };
  const live = {
    href: liveUrl,
    label: t("live"),
    hint: liveUrl ? t("liveHint") : t("liveClosed"),
    icon: <LuExternalLink className="size-4" aria-hidden />,
  };

  if (variant === "icons") {
    return (
      <div className="flex items-center justify-center gap-2.5">
        <IconLink {...code} align="center" />
        <IconLink {...live} align="center" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonLink {...live} primary />
      <ButtonLink {...code} />
    </div>
  );
}

type LinkProps = { href?: string | null; label: string; hint: string; icon: ReactNode };

function IconLink({ href, hint, icon, align }: LinkProps & { align: "start" | "center" | "end" }) {
  const base =
    "inline-flex size-9 items-center justify-center rounded-full border transition-[color,background-color,border-color,transform,translate,scale] duration-200";
  return (
    <Tooltip label={hint} align={align} className="z-10">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={hint}
          className={`${base} border-line bg-tint/[0.03] text-muted hover:border-accent/60 hover:bg-accent/10 hover:text-accent active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
        >
          {icon}
        </a>
      ) : (
        <button
          type="button"
          aria-disabled="true"
          aria-label={hint}
          className={`${base} border-dashed border-line text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-strong`}
        >
          {icon}
        </button>
      )}
    </Tooltip>
  );
}

function ButtonLink({ href, label, hint, icon, primary = false }: LinkProps & { primary?: boolean }) {
  const base =
    "inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 font-display text-sm transition-[color,background-color,border-color,box-shadow,transform,translate,scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";
  if (!href) {
    return (
      <Tooltip label={hint}>
        <button
          type="button"
          aria-disabled="true"
          aria-label={`${label} — ${hint}`}
          className={`${base} cursor-not-allowed border border-dashed border-line text-faint`}
        >
          {icon}
          {label}
          <LuLock className="size-3.5" aria-hidden />
        </button>
      </Tooltip>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — ${hint}`}
      className={`${base} active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        primary
          ? "bg-accent-strong text-white shadow-[0_8px_24px_-10px_rgb(66_135_255/0.9)] hover:-translate-y-0.5 hover:bg-[#5797ff] light:hover:bg-accent hover:shadow-[0_12px_30px_-10px_rgb(66_135_255/1)]"
          : "border border-line-strong text-fg hover:-translate-y-0.5 hover:border-accent hover:text-accent"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

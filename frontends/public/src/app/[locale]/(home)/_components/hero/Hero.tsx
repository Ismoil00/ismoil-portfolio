import { getTranslations } from "next-intl/server";
import { LuMouse } from "react-icons/lu";
import type { Locale } from "@/i18n/routing";
import { getProfile } from "@/api/content.api";
import { formatDuration } from "@/lib/dates";
import { Container } from "@/components/ui/Container";
import { RichText } from "@/components/ui/RichText";
import { JumpCards } from "./JumpCards";
import { AvailabilityBadge } from "./AvailabilityBadge";

export async function Hero({ locale }: { locale: Locale }) {
  const [profile, t, tx] = await Promise.all([
    getProfile(locale),
    getTranslations({ locale, namespace: "hero" }),
    getTranslations({ locale, namespace: "experience" }),
  ]);
  const { stats } = profile;
  // Only numbers in the jump cards, so new jobs/projects never make them grow.
  const experienceTotal = formatDuration(stats.experienceMonths, (k, v) => tx(k, v));

  // Every number is counted by the backend from the content, so it stays right as things are
  // added. Years get a "+" when there are extra months; a count of 0 is not shown.
  const years = Math.floor(stats.experienceMonths / 12);
  const cards = [
    { count: years, value: `${years}${stats.experienceMonths % 12 ? "+" : ""}`, label: "statYears" },
    { count: stats.projects, value: String(stats.projects), label: "statProjects" },
    { count: stats.certificates, value: String(stats.certificates), label: "statCertificates" },
    { count: stats.technologies, value: String(stats.technologies), label: "statTechs" },
  ] as const;
  const shownStats = cards
    .filter((c) => c.count > 0)
    .map((c) => ({ value: c.value, label: t(c.label, { count: c.count }) }));

  return (
    // md:pb-24 reserves room for the "Scroll" hint (shown from md up) so it never touches the stats,
    // even when the hero content is taller than the screen (tablets, short laptop screens).
    <section className="relative flex min-h-svh flex-col justify-center pb-16 pt-28 md:pb-24">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          {/* @container: the name scales with this column's width (cqi), not the viewport,
              so it never collides with the jump cards — even with wider Cyrillic glyphs. */}
          <div className="@container animate-fade-up">
            <AvailabilityBadge status={profile.availability} />

            <p className="font-display text-xl text-accent sm:text-2xl">{t("greeting")}</p>
            <h1 className="mt-2 font-display text-[clamp(2.5rem,17cqi,7.5rem)] font-bold uppercase leading-[0.9] tracking-tight">
              <span className="block">{profile.firstName}</span>
              <span className="block bg-gradient-to-r from-accent-soft via-accent to-accent-strong bg-clip-text text-transparent">
                {profile.lastName}
              </span>
            </h1>

            <p className="mt-6 font-display text-2xl font-medium text-fg sm:text-3xl">{profile.role}</p>
            {profile.tagline && (
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
                <RichText text={profile.tagline} />
              </p>
            )}
          </div>

          <div className="animate-fade-up [animation-delay:250ms]">
            <JumpCards
              label={t("jumpLabel")}
              cards={[
                {
                  href: "#projects",
                  icon: "work",
                  title: t("work"),
                  hint: t("workHint", { count: stats.projects }),
                },
                {
                  href: "#experience",
                  icon: "experience",
                  title: t("experience"),
                  hint: t("experienceHint", { count: stats.roles, duration: experienceTotal }),
                },
              ]}
            />
          </div>
        </div>

        {/* Two per row on small screens (consistent with other sections); all four in one row on lg+. */}
        <dl className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {shownStats.map((s, i) => (
            <div
              key={s.label}
              className="animate-fade-up rounded-2xl border border-line bg-card p-4 backdrop-blur-sm sm:p-5"
              style={{ animationDelay: `${350 + i * 120}ms` }}
            >
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-3xl font-bold text-accent sm:text-4xl">{s.value}</dd>
              <dd className="mt-1 text-sm text-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </Container>

      <a
        href="#about"
        className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs uppercase tracking-widest text-faint transition-colors hover:text-accent md:flex"
      >
        <LuMouse className="size-5 animate-bounce" aria-hidden />
        {t("scroll")}
      </a>
    </section>
  );
}

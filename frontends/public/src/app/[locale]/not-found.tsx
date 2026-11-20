import { useTranslations } from "next-intl";
import { LuArrowLeft, LuAward, LuBriefcaseBusiness, LuFolderKanban, LuSend } from "react-icons/lu";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/Container";

// The main places to go from here; their labels are the menu's (messages `nav.*`).
const SECTIONS = [
  { href: "/projects", label: "projects", icon: LuFolderKanban },
  { href: "/experience", label: "experience", icon: LuBriefcaseBusiness },
  { href: "/certificates", label: "certificates", icon: LuAward },
  { href: "/#contact", label: "contact", icon: LuSend },
] as const;

/**
 * The site's 404 page: unknown addresses ([...rest]/page.tsx) and missing content (e.g. a project).
 * Only theme colors are used, so it follows the light/dark theme; the motion stops for visitors who
 * ask for reduced motion.
 */
export default function NotFound() {
  const t = useTranslations("notFound");
  const nav = useTranslations("nav");

  return (
    <section className="relative isolate flex min-h-svh items-center overflow-hidden pb-20 pt-32">
      {/* A soft light behind the number. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[40%] -z-10 size-[min(36rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-strong/15 blur-[110px] light:bg-glow/25"
      />

      <Container className="flex flex-col items-center text-center">
        <p className="flex animate-fade-up items-center gap-3 font-display text-sm uppercase tracking-[0.25em] text-accent">
          <span className="h-px w-8 bg-accent" aria-hidden />
          {t("eyebrow")}
          <span className="h-px w-8 bg-accent" aria-hidden />
        </p>

        {/* The number floats slowly; its shadow on the "floor" shrinks and fades as it rises. */}
        <div aria-hidden className="relative mt-6 animate-fade-up select-none [animation-delay:120ms]">
          <p className="bg-gradient-to-b from-fg via-accent-soft to-accent-strong bg-clip-text pb-2 font-display text-[clamp(7rem,28vw,15rem)] font-bold leading-[0.85] tracking-[-0.04em] text-transparent motion-safe:animate-float-404">
            404
          </p>
          <span className="absolute inset-x-[18%] -bottom-6 h-5 rounded-[50%] bg-accent-strong/35 blur-xl motion-safe:animate-float-404-shadow light:bg-accent/25" />
        </div>

        <h1 className="mt-14 animate-fade-up font-display text-3xl font-semibold text-fg [animation-delay:200ms] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl animate-fade-up text-lg leading-relaxed text-muted [animation-delay:260ms] sm:text-xl">
          {t("text")}
        </p>

        <Link
          href="/"
          className="group mt-10 inline-flex animate-fade-up items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-display font-medium text-bg transition-colors [animation-delay:320ms] hover:bg-accent-soft"
        >
          <LuArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
          {t("back")}
        </Link>

        <nav aria-label={t("sections")} className="mt-12 animate-fade-up [animation-delay:380ms]">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-subtle">{t("sections")}</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2.5">
            {SECTIONS.map(({ href, label, icon: Icon }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm text-fg backdrop-blur-sm transition-colors hover:border-accent/50 hover:text-accent"
                >
                  <Icon className="size-4 text-accent" aria-hidden />
                  {nav(label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </section>
  );
}

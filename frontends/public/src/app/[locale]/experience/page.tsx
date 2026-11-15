import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LuArrowLeft } from "react-icons/lu";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getExperienceFilterOptions, getExperiencePage } from "@/api/experience.api";
import { Container } from "@/components/ui/Container";
import { HashHighlight } from "@/components/ui/HashHighlight";
import { ExperienceExplorer } from "./_components/ExperienceExplorer";
import { PAGE_SIZE } from "./_components/constants";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "experiencePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/experience`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/experience`])),
    },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: `/${locale}/experience` },
  };
}

/** /[locale]/experience — every position, with filters and "Show more" (10 at a time). */
export default async function ExperiencePageRoute({ params }: Props) {
  const { locale: raw } = await params;
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const [initial, options, t] = await Promise.all([
    getExperiencePage(locale, { offset: 0, limit: PAGE_SIZE }),
    getExperienceFilterOptions(locale),
    getTranslations({ locale, namespace: "experiencePage" }),
  ]);

  return (
    <section className="pb-24 pt-28 sm:pt-32">
      <HashHighlight />
      <Container>
        <Link
          href="/#experience"
          className="group mb-8 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-accent"
        >
          <LuArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden />
          {t("back")}
        </Link>

        <p className="mb-3 flex items-center gap-3 font-display text-sm uppercase tracking-[0.25em] text-accent">
          <span className="h-px w-8 bg-accent" aria-hidden />
          {t("eyebrow")}
        </p>
        <h1 className="mb-10 font-display text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{t("title")}</h1>

        <ExperienceExplorer initial={initial} options={options} />
      </Container>
    </section>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LuArrowLeft } from "react-icons/lu";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getTestimonialFilterOptions, getTestimonialsPage } from "@/api/testimonials.api";
import { Container } from "@/components/ui/Container";
import { TestimonialsExplorer } from "./_components/TestimonialsExplorer";
import { PAGE_SIZE } from "./_components/constants";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "testimonialsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/testimonials`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/testimonials`])),
    },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: `/${locale}/testimonials` },
  };
}

/** /[locale]/testimonials — every testimonial, with a date filter and "Show more" (10 at a time). */
export default async function TestimonialsPageRoute({ params }: Props) {
  const { locale: raw } = await params;
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const [initial, options, t] = await Promise.all([
    getTestimonialsPage(locale, { offset: 0, limit: PAGE_SIZE }),
    getTestimonialFilterOptions(),
    getTranslations({ locale, namespace: "testimonialsPage" }),
  ]);
  // No testimonials yet: the page doesn't exist (the menu and the home page hide it too).
  if (initial.total === 0) notFound();

  return (
    <section className="pb-24 pt-28 sm:pt-32">
      <Container>
        <Link
          href="/#testimonials"
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

        <TestimonialsExplorer initial={initial} options={options} />
      </Container>
    </section>
  );
}

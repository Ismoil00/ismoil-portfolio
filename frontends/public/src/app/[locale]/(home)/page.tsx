import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { SectionSkeleton } from "@/components/ui/Skeleton";
import { Hero } from "./_components/hero/Hero";
import { About } from "./_components/about/About";
import { Skills } from "./_components/skills/Skills";
import { Experience } from "./_components/experience/Experience";
import { Projects } from "./_components/projects/Projects";
import { Certificates } from "./_components/certificates/Certificates";
import { Contact } from "./_components/contact/Contact";
import { Testimonials } from "./_components/testimonials/Testimonials";
import { HashHighlight } from "@/components/ui/HashHighlight";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  // Layout and page render in parallel, so the page must reject unknown "locales" itself
  // (e.g. the browser's automatic /favicon.ico request lands here as locale "favicon.ico").
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  // Each section fetches its own data. Wrapped in <Suspense>, every section streams
  // to the browser as soon as it is ready instead of waiting for the slowest one.
  return (
    <>
      {/* Glows the card a link jumped to (#project-…, #testimonial-…). */}
      <HashHighlight />
      <Suspense fallback={<div className="min-h-svh" />}>
        <Hero locale={locale} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton rows={2} />}>
        <About locale={locale} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton rows={6} />}>
        <Skills locale={locale} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton rows={3} />}>
        <Experience locale={locale} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton rows={3} />}>
        <Projects locale={locale} />
      </Suspense>
      <Suspense fallback={null}>
        <Testimonials locale={locale} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton rows={3} />}>
        <Certificates locale={locale} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton rows={2} />}>
        <Contact locale={locale} />
      </Suspense>
    </>
  );
}

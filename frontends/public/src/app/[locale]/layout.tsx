import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Space_Grotesk, Tajawal, Manrope } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getProfile } from "@/api/content.api";
import { getTestimonialsPage } from "@/api/testimonials.api";
import { Header } from "@/components/layout/Header";
import { visibleNavItems } from "@/components/layout/nav-items";
import { Footer } from "@/components/layout/Footer";
import { SocialRail } from "@/components/layout/SocialRail";
import { BackgroundGlow } from "@/components/layout/BackgroundGlow";
import { siteUrl } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import "../globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const tajawal = Tajawal({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});
// Neither font above has Cyrillic glyphs, so Russian/Tajik text falls back to Manrope.
const manrope = Manrope({
  subsets: ["cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

// Content comes from the backend and changes from the admin panel: render on each request.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = { themeColor: "#080a0f", colorScheme: "dark" };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(siteUrl),
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: { ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])), "x-default": "/en" },
    },
    openGraph: {
      type: "profile",
      title: t("title"),
      description: t("description"),
      url: `/${locale}`,
      siteName: "Ismoil Sharifov",
      locale,
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [profile, testimonials] = await Promise.all([
    getProfile(locale as Locale),
    // Only the count matters here: the menu links "Testimonials" only while that section is shown.
    getTestimonialsPage(locale as Locale, { offset: 0, limit: 1 }),
  ]);
  const navItems = visibleNavItems({ hasTestimonials: testimonials.total > 0 });

  // Structured data so search engines understand this is a person's profile.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.fullName,
    jobTitle: profile.role,
    ...(profile.email ? { email: `mailto:${profile.email}` } : {}),
    address: { "@type": "PostalAddress", addressLocality: profile.about.city, addressCountry: profile.about.countryCode },
    url: `${siteUrl}/${locale}`,
    // Public profiles (LinkedIn, GitHub…), not chat links.
    sameAs: [...profile.contacts, ...profile.otherLinks]
      .map((l) => l.url)
      .filter((u) => u.startsWith("https://") && !/wa\.me|t\.me/.test(u)),
  };

  return (
    <html
      lang={locale}
      className={`${spaceGrotesk.variable} ${tajawal.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a saved light theme before the first paint (no dark flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body id="top" className="min-h-svh">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <NextIntlClientProvider>
          <BackgroundGlow />
          <Header resumeUrl={profile.resumeUrl} navItems={navItems} />
          <SocialRail profile={profile} />
          <main>{children}</main>
          <Footer profile={profile} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

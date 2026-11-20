import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "notFound" });
  return { title: t("title") };
}

/**
 * Every address no other page matches (e.g. /en/abc): shows the site's own 404 page (../not-found.tsx)
 * inside the usual header and footer, with a 404 status. Without it, Next.js shows its plain default page.
 */
export default function UnknownAddress() {
  notFound();
}

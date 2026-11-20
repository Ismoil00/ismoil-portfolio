import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cookiesPage" });
  return { title: t("title"), alternates: { canonical: `/${locale}/cookies` } };
}

/** What the site stores in the visitor's browser, and why (the banner links here). */
export default async function CookiesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cookiesPage");
  const c = await getTranslations("consent");
  const sections = [
    [c("necessary"), t("necessaryText")],
    [c("analytics"), t("analyticsText")],
    [c("preferences"), t("preferencesText")],
  ];

  return (
    <Container className="max-w-3xl pt-32 pb-24">
      <h1 className="font-display text-4xl font-bold text-fg">{t("title")}</h1>
      <p className="mt-4 text-muted">{t("intro")}</p>
      <dl className="mt-10 space-y-6">
        {sections.map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-line bg-card p-5">
            <dt className="font-display text-lg font-semibold text-fg">{title}</dt>
            <dd className="mt-2 text-muted">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-muted">{t("thirdParty")}</p>
      <p className="mt-4 flex flex-wrap items-center gap-3 text-muted">
        {t("change")}
        <CookieSettingsButton
          label={c("settingsTitle")}
          className="rounded-full border border-line bg-card px-4 py-2 text-sm text-fg hover:border-accent/50"
        />
      </p>
    </Container>
  );
}

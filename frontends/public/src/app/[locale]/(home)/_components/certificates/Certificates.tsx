import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getCertificatesPage } from "@/api/certificates.api";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { CertificateCard } from "@/components/certificates/CertificateCard";

/** How many certificates the home page shows; the rest live on /certificates. */
const HOME_LIMIT = 3;

export async function Certificates({ locale }: { locale: Locale }) {
  const [{ items, total }, t, tc] = await Promise.all([
    getCertificatesPage(locale, { offset: 0, limit: HOME_LIMIT }),
    getTranslations({ locale, namespace: "sections.certificates" }),
    getTranslations({ locale, namespace: "certificates" }),
  ]);
  if (total === 0) return null;

  return (
    <Section id="certificates" eyebrow={t("eyebrow")} title={t("title")}>
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <Reveal as="li" key={item.id} delay={(i % 3) * 100} className="h-full">
            <CertificateCard item={item} />
          </Reveal>
        ))}
      </ul>

      {total > HOME_LIMIT && (
        <div className="mt-10 flex justify-center">
          <ViewAllLink href="/certificates" label={tc("viewAll")} count={tc("viewAllCount", { count: total })} />
        </div>
      )}
    </Section>
  );
}

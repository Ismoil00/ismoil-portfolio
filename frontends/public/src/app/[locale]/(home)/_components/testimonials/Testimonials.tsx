import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getTestimonialsPage } from "@/api/testimonials.api";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { TestimonialCard } from "@/components/testimonials/TestimonialCard";

/** How many testimonials the home page shows; the rest live on /testimonials. */
const HOME_LIMIT = 3;

/** Reviews from colleagues and clients. Hidden until at least one real testimonial exists. */
export async function Testimonials({ locale }: { locale: Locale }) {
  const [{ items, total }, t, tt] = await Promise.all([
    getTestimonialsPage(locale, { offset: 0, limit: HOME_LIMIT }),
    getTranslations({ locale, namespace: "sections.testimonials" }),
    getTranslations({ locale, namespace: "testimonials" }),
  ]);
  if (total === 0) return null;

  return (
    <Section id="testimonials" eyebrow={t("eyebrow")} title={t("title")}>
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <Reveal as="li" key={item.id} delay={(i % 3) * 100} className="h-full">
            <TestimonialCard item={item} />
          </Reveal>
        ))}
      </ul>

      {total > HOME_LIMIT && (
        <div className="mt-10 flex justify-center">
          <ViewAllLink href="/testimonials" label={tt("viewAll")} count={tt("viewAllCount", { count: total })} />
        </div>
      )}
    </Section>
  );
}

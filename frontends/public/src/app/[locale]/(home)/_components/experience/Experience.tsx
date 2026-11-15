import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getExperiencePage } from "@/api/experience.api";
import { Section } from "@/components/ui/Section";
import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { ExperienceTimeline, TimelineItem } from "@/components/experience/ExperienceTimeline";
import { ExperienceCard } from "@/components/experience/ExperienceCard";

/** How many positions the home page shows; the rest live on /experience. */
const HOME_LIMIT = 3;

export async function Experience({ locale }: { locale: Locale }) {
  const [{ items, total }, t, tx] = await Promise.all([
    getExperiencePage(locale, { offset: 0, limit: HOME_LIMIT }),
    getTranslations({ locale, namespace: "sections.experience" }),
    getTranslations({ locale, namespace: "experience" }),
  ]);

  return (
    <Section id="experience" eyebrow={t("eyebrow")} title={t("title")}>
      <ExperienceTimeline>
        {items.map((job) => (
          <TimelineItem key={job.id}>
            <ExperienceCard item={job} />
          </TimelineItem>
        ))}
      </ExperienceTimeline>

      {total > HOME_LIMIT && (
        <div className="tl-list mt-10" data-timeline>
          <ViewAllLink href="/experience" label={tx("viewAll")} count={tx("viewAllCount", { count: total })} />
        </div>
      )}
    </Section>
  );
}

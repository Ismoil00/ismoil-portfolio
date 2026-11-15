import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getProjectsPage } from "@/api/projects.api";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { ProjectCard } from "@/components/projects/ProjectCard";

/** How many projects the home page shows; the rest live on /projects. */
const HOME_LIMIT = 3;

export async function Projects({ locale }: { locale: Locale }) {
  const [{ items, total }, t, tp] = await Promise.all([
    getProjectsPage(locale, { offset: 0, limit: HOME_LIMIT }),
    getTranslations({ locale, namespace: "sections.projects" }),
    getTranslations({ locale, namespace: "projects" }),
  ]);

  return (
    <Section id="projects" eyebrow={t("eyebrow")} title={t("title")}>
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((project, i) => (
          <Reveal as="li" key={project.id} delay={(i % 3) * 100} className="h-full">
            <ProjectCard project={project} index={i} />
          </Reveal>
        ))}
      </ul>

      {total > HOME_LIMIT && (
        <div className="mt-10 flex justify-center">
          <ViewAllLink href="/projects" label={tp("viewAll")} count={tp("viewAllCount", { count: total })} />
        </div>
      )}
    </Section>
  );
}

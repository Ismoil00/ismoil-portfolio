import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSkills } from "@/api/content.api";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { SkillsExplorer } from "./SkillsExplorer";

export async function Skills({ locale }: { locale: Locale }) {
  const [skills, t] = await Promise.all([getSkills(locale), getTranslations({ locale, namespace: "sections.skills" })]);

  return (
    <Section id="skills" eyebrow={t("eyebrow")} title={t("title")}>
      <Reveal>
        <SkillsExplorer skills={skills} />
      </Reveal>
    </Section>
  );
}

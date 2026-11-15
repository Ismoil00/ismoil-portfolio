import type { Metadata } from "next";
import { loadOptions } from "@/api/options";
import { EditorHeader } from "@/components/layout/EditorHeader";
import { ExperienceForm } from "../ExperienceForm";

export const metadata: Metadata = { title: "New experience" };

export default async function NewExperiencePage() {
  const [companies, techs, fields, projects, testimonials, experiences] = await Promise.all([
    loadOptions.companies(),
    loadOptions.techs(),
    loadOptions.fields(),
    loadOptions.projects(),
    loadOptions.testimonials(),
    loadOptions.experiences(),
  ]);
  const present = experiences.find((e) => e.is_current);

  return (
    <>
      <EditorHeader backHref="/experience" backLabel="Experience" title="New experience" />
      <ExperienceForm
        item={null}
        presentElsewhere={present?.title.en ?? null}
        companies={companies}
        techs={techs}
        fields={fields}
        projects={projects}
        testimonials={testimonials}
      />
    </>
  );
}

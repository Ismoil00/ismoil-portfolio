import type { Metadata } from "next";
import { loadOptions } from "@/api/options";
import { serverGet } from "@/api/server";
import { EditorHeader } from "@/components/layout/EditorHeader";
import type { Experience } from "@/types/api";
import { ExperienceForm } from "../ExperienceForm";

export const metadata: Metadata = { title: "Edit experience" };

export default async function EditExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, companies, techs, fields, projects, testimonials, experiences] = await Promise.all([
    serverGet<Experience>(`/admin/experiences/${encodeURIComponent(id)}`),
    loadOptions.companies(),
    loadOptions.techs(),
    loadOptions.fields(),
    loadOptions.projects(),
    loadOptions.testimonials(),
    loadOptions.experiences(),
  ]);
  const present = experiences.find((e) => e.is_current && e.id !== item.id);

  return (
    <>
      <EditorHeader
        backHref="/experience"
        backLabel="Experience"
        title={item.title.en}
        deleteUrl={`/admin/experiences/${item.id}`}
        itemName={`${item.title.en} at ${item.company.name}`}
      />
      <ExperienceForm
        item={item}
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

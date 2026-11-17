import type { Metadata } from "next";
import { loadOptions } from "@/api/options";
import { EditorHeader } from "@/components/layout/EditorHeader";
import { TestimonialForm } from "../TestimonialForm";

export const metadata: Metadata = { title: "New testimonial" };

export default async function NewTestimonialPage() {
  const [companies, fields, techs, projects] = await Promise.all([
    loadOptions.companies(),
    loadOptions.fields(),
    loadOptions.techs(),
    loadOptions.projects(),
  ]);
  return (
    <>
      <EditorHeader backHref="/testimonials" backLabel="Testimonials" title="New testimonial" />
      <TestimonialForm item={null} companies={companies} fields={fields} techs={techs} projects={projects} />
    </>
  );
}

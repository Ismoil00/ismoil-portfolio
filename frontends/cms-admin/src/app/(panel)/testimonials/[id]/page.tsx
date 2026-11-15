import type { Metadata } from "next";
import { loadOptions } from "@/api/options";
import { serverGet } from "@/api/server";
import { EditorHeader } from "@/components/layout/EditorHeader";
import type { Testimonial } from "@/types/api";
import { TestimonialForm } from "../TestimonialForm";

export const metadata: Metadata = { title: "Edit testimonial" };

export default async function EditTestimonialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, companies, positions, projects] = await Promise.all([
    serverGet<Testimonial>(`/admin/testimonials/${encodeURIComponent(id)}`),
    loadOptions.companies(),
    loadOptions.positions(),
    loadOptions.projects(),
  ]);
  return (
    <>
      <EditorHeader backHref="/testimonials" backLabel="Testimonials" title={item.author_name.en} deleteUrl={`/admin/testimonials/${item.id}`} itemName={`the testimonial from ${item.author_name.en}`} />
      <TestimonialForm item={item} companies={companies} positions={positions} projects={projects} />
    </>
  );
}

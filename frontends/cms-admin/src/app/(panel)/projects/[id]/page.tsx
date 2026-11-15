import type { Metadata } from "next";
import { loadOptions } from "@/api/options";
import { serverGet } from "@/api/server";
import { EditorHeader } from "@/components/layout/EditorHeader";
import type { Project } from "@/types/api";
import { ProjectForm } from "../ProjectForm";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, companies, types, techs] = await Promise.all([
    serverGet<Project>(`/admin/projects/${encodeURIComponent(id)}`),
    loadOptions.companies(),
    loadOptions.productTypes(),
    loadOptions.techs(),
  ]);
  return (
    <>
      <EditorHeader backHref="/projects" backLabel="Projects" title={item.title.en} deleteUrl={`/admin/projects/${item.id}`} itemName={item.title.en} />
      <ProjectForm item={item} companies={companies} types={types} techs={techs} />
    </>
  );
}

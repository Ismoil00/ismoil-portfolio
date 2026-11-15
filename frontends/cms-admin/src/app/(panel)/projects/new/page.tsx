import type { Metadata } from "next";
import { loadOptions } from "@/api/options";
import { EditorHeader } from "@/components/layout/EditorHeader";
import { ProjectForm } from "../ProjectForm";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const [companies, types, techs] = await Promise.all([loadOptions.companies(), loadOptions.productTypes(), loadOptions.techs()]);
  return (
    <>
      <EditorHeader backHref="/projects" backLabel="Projects" title="New project" />
      <ProjectForm item={null} companies={companies} types={types} techs={techs} />
    </>
  );
}

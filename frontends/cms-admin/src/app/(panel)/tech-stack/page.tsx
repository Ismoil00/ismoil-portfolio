import type { Metadata } from "next";
import { serverGet } from "@/api/server";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DevelopmentField, Instrument, TechShowcase, TechStack } from "@/types/api";
import { TechStackForm } from "./TechStackForm";

export const metadata: Metadata = { title: "Tech stack" };

export default async function TechStackPage() {
  const [showcase, fields, instruments, techs] = await Promise.all([
    serverGet<TechShowcase>("/admin/tech-showcase"),
    serverGet<DevelopmentField[]>("/admin/selectors/development-fields"),
    serverGet<Instrument[]>("/admin/selectors/instruments"),
    serverGet<TechStack[]>("/admin/selectors/tech-stacks"),
  ]);

  return (
    <>
      <PageHeader
        title="Tech stack"
        description="Pick which filters and technologies the site's Tech stack section shows, and in what order. Create new ones on the Selectors page."
      />
      <TechStackForm showcase={showcase} fields={fields} instruments={instruments} techs={techs} />
    </>
  );
}

import type { Metadata } from "next";
import { serverGet } from "@/api/server";
import { PageHeader } from "@/components/layout/PageHeader";
import type { Hero } from "@/types/api";
import { HeroForm } from "./HeroForm";

export const metadata: Metadata = { title: "Hero" };

export default async function HeroPage() {
  const hero = await serverGet<Hero | null>("/admin/hero");
  return (
    <>
      <PageHeader title="Hero" description="The first screen of the site: your name, title, résumé and job-search status." />
      <HeroForm hero={hero} />
    </>
  );
}

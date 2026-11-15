import type { Metadata } from "next";
import { serverGet } from "@/api/server";
import { PageHeader } from "@/components/layout/PageHeader";
import type { About } from "@/types/api";
import { AboutForm } from "./AboutForm";

export const metadata: Metadata = { title: "About me" };

export default async function AboutPage() {
  const about = await serverGet<About | null>("/admin/about");
  return (
    <>
      <PageHeader title="About me" description="The About section: a title, one or two paragraphs, where you are and how you work." />
      <AboutForm about={about} />
    </>
  );
}

import type { Metadata } from "next";
import { loadOptions } from "@/api/options";
import { EditorHeader } from "@/components/layout/EditorHeader";
import { CertificateForm } from "../CertificateForm";

export const metadata: Metadata = { title: "New certificate" };

export default async function NewCertificatePage() {
  const [institutes, fields] = await Promise.all([loadOptions.institutes(), loadOptions.fields()]);
  return (
    <>
      <EditorHeader backHref="/certificates" backLabel="Certificates" title="New certificate" />
      <CertificateForm item={null} institutes={institutes} fields={fields} />
    </>
  );
}

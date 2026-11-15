import type { Metadata } from "next";
import { loadOptions } from "@/api/options";
import { serverGet } from "@/api/server";
import { EditorHeader } from "@/components/layout/EditorHeader";
import type { Certificate } from "@/types/api";
import { CertificateForm } from "../CertificateForm";

export const metadata: Metadata = { title: "Edit certificate" };

export default async function EditCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, institutes, fields] = await Promise.all([
    serverGet<Certificate>(`/admin/certificates/${encodeURIComponent(id)}`),
    loadOptions.institutes(),
    loadOptions.fields(),
  ]);
  return (
    <>
      <EditorHeader backHref="/certificates" backLabel="Certificates" title={item.title.en} deleteUrl={`/admin/certificates/${item.id}`} itemName={item.title.en} />
      <CertificateForm item={item} institutes={institutes} fields={fields} />
    </>
  );
}

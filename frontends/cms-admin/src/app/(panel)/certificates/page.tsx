import type { Metadata } from "next";
import { LuAward } from "react-icons/lu";
import { serverGet } from "@/api/server";
import { Badge, ListPage, ListRow } from "@/components/layout/ListPage";
import { formatMonth } from "@/lib/dates";
import type { Certificate } from "@/types/api";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesListPage() {
  const items = await serverGet<Certificate[]>("/admin/certificates");
  return (
    <ListPage
      title="Certificates"
      description="Certificates and diplomas, newest first. Click one to edit it."
      addHref="/certificates/new"
      addLabel="Add certificate"
      emptyText="No certificates yet."
      count={items.length}
    >
      {items.map((c) => (
        <ListRow
          key={c.id}
          href={`/certificates/${c.id}`}
          media={
            <div className="grid aspect-[4/3] w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-tint/[0.03]">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file */}
              {c.images[0] ? <img src={c.images[0].url} alt="" className="size-full object-cover" /> : <LuAward className="size-5 text-faint" />}
            </div>
          }
          title={c.title.en}
          subtitle={c.institute.name.en}
          badges={
            <>
              {c.images.length === 0 && <Badge tone="warning">Missing: image</Badge>}
              {!c.verify_url && <Badge tone="warning">Missing: verification link</Badge>}
              {c.images.length > 0 && <Badge>{c.images.length} image{c.images.length === 1 ? "" : "s"}</Badge>}
            </>
          }
          meta={`${formatMonth(c.start)} — ${formatMonth(c.end)}`}
        />
      ))}
    </ListPage>
  );
}

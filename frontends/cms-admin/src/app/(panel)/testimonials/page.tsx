import type { Metadata } from "next";
import { LuPlay, LuQuote } from "react-icons/lu";
import { serverGet } from "@/api/server";
import { Badge, ListPage, ListRow } from "@/components/layout/ListPage";
import { plural } from "@/lib/dates";
import type { Testimonial } from "@/types/api";

export const metadata: Metadata = { title: "Testimonials" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function TestimonialsListPage() {
  const items = await serverGet<Testimonial[]>("/admin/testimonials");
  return (
    <ListPage
      title="Testimonials"
      description="What people say about working with you, newest first. The section is hidden on the site while this list is empty."
      addHref="/testimonials/new"
      addLabel="Add testimonial"
      emptyText="No testimonials yet."
      count={items.length}
    >
      {items.map((t) => {
        const isVideo = t.media?.content_type.startsWith("video/");
        const thumb = isVideo ? t.media?.poster_url : t.media?.url;
        return (
          <ListRow
            key={t.id}
            href={`/testimonials/${t.id}`}
            media={
              <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-tint/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file */}
                {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <LuQuote className="size-5 text-faint" />}
                {isVideo && <LuPlay className="absolute size-4 text-white drop-shadow" />}
              </div>
            }
            title={t.author_name.en}
            subtitle={`${t.author_role.en} · ${t.company.name}`}
            badges={
              <>
                <Badge>My role: {t.role.en}</Badge>
                {t.project_ids.length > 0 && <Badge>{plural(t.project_ids.length, "project", "projects")}</Badge>}
                {!t.quote && <Badge tone="warning">No quote</Badge>}
              </>
            }
            meta={dateFormat.format(new Date(t.given_on))}
          />
        );
      })}
    </ListPage>
  );
}

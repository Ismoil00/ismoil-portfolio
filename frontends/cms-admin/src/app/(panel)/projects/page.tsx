import type { Metadata } from "next";
import { LuFolderKanban, LuLock } from "react-icons/lu";
import { serverGet } from "@/api/server";
import { Badge, ListPage, ListRow } from "@/components/layout/ListPage";
import { formatMonth, plural } from "@/lib/dates";
import type { Project } from "@/types/api";

export const metadata: Metadata = { title: "Projects" };

function clientLabel(p: Project) {
  return p.client_kind === "company" ? p.company?.name : p.client_kind === "private" ? "Private client" : "Self-initiated";
}

export default async function ProjectsListPage() {
  const items = await serverGet<Project[]>("/admin/projects");
  return (
    <ListPage
      title="Projects"
      description="Everything you've built, newest first. Click one to edit it."
      addHref="/projects/new"
      addLabel="Add project"
      emptyText="No projects yet."
      count={items.length}
    >
      {items.map((p) => {
        const cover = p.media.find((m) => m.id === p.cover_id) ?? p.media.find((m) => m.content_type.startsWith("image/"));
        // A video cover shows its first frame: the poster captured on upload, or the video itself.
        const coverVideo = cover?.content_type.startsWith("video/") ? cover : null;
        const thumb = coverVideo ? coverVideo.poster_url : (cover?.url ?? p.media.find((m) => m.poster_url)?.poster_url);
        return (
          <ListRow
            key={p.id}
            href={`/projects/${p.id}`}
            media={
              <div className="grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-tint/[0.03]">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded file
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : coverVideo ? (
                  <video src={coverVideo.url} muted preload="metadata" className="size-full object-cover" />
                ) : (
                  <LuFolderKanban className="size-5 text-faint" />
                )}
              </div>
            }
            title={p.title.en}
            subtitle={clientLabel(p)}
            badges={
              <>
                {p.is_private && (
                  <Badge tone="warning">
                    <LuLock className="mr-1 inline size-3" />
                    Private
                  </Badge>
                )}
                {!p.traffic && <Badge tone="warning">Missing: monthly traffic</Badge>}
                <Badge>{plural(p.media.length, "file", "files")}</Badge>
                <Badge>{plural(p.tech_ids.length, "technology", "technologies")}</Badge>
              </>
            }
            meta={
              <>
                <p>
                  {formatMonth(p.start)} — {formatMonth(p.end)}
                </p>
                <p className="text-xs text-faint">/projects/{p.slug}</p>
              </>
            }
          />
        );
      })}
    </ListPage>
  );
}

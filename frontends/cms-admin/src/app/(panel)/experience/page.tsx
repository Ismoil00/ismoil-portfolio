import type { Metadata } from "next";
import { LuBuilding2 } from "react-icons/lu";
import { serverGet } from "@/api/server";
import { Badge, ListPage, ListRow } from "@/components/layout/ListPage";
import { formatDuration, formatPeriod, monthsBetween, plural } from "@/lib/dates";
import type { Experience } from "@/types/api";

export const metadata: Metadata = { title: "Experience" };

export default async function ExperienceListPage() {
  const items = await serverGet<Experience[]>("/admin/experiences");
  return (
    <ListPage
      title="Experience"
      description="Your jobs, newest first (the present one on top). Click one to edit it."
      addHref="/experience/new"
      addLabel="Add experience"
      emptyText="No experience entries yet."
      count={items.length}
    >
      {items.map((item) => (
        <ListRow
          key={item.id}
          href={`/experience/${item.id}`}
          media={
            <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-tint/[0.03]">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded logo */}
              {item.company.logo_url ? <img src={item.company.logo_url} alt="" className="max-h-8 max-w-8 object-contain" /> : <LuBuilding2 className="size-5 text-faint" />}
            </div>
          }
          title={item.title.en}
          subtitle={item.company.name}
          badges={
            <>
              {item.is_current && <Badge tone="success">Present</Badge>}
              <Badge>{plural(item.tech_ids.length, "technology", "technologies")}</Badge>
              {item.project_ids.length > 0 && <Badge>{plural(item.project_ids.length, "project", "projects")}</Badge>}
              {item.testimonial_ids.length > 0 && <Badge>{plural(item.testimonial_ids.length, "testimonial", "testimonials")}</Badge>}
            </>
          }
          meta={
            <>
              <p>{formatPeriod(item.start, item.end)}</p>
              <p className="text-xs text-faint">{formatDuration(monthsBetween(item.start, item.end))}</p>
            </>
          }
        />
      ))}
    </ListPage>
  );
}

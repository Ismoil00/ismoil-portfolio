"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Skills } from "@/types/content";
import { LuLayoutGrid } from "react-icons/lu";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { TechTile } from "./TechTile";

const ALL = "all";

/**
 * Category filters (left-aligned) above a centered wall of tech tiles.
 * Picking a category hides unrelated tiles; the remaining ones pop back in.
 * The server-rendered HTML contains every tile, so all links are crawlable.
 */
export function SkillsExplorer({ skills }: { skills: Skills }) {
  const t = useTranslations("skills");
  const [active, setActive] = useState<string>(ALL);

  const filters = [
    { id: ALL, title: t("all"), icon: null as string | null, count: skills.items.length },
    ...skills.categories.map((c) => ({
      ...c,
      count: skills.items.filter((i) => i.categories.includes(c.id)).length,
    })),
  ];
  const visible = active === ALL ? skills.items : skills.items.filter((i) => i.categories.includes(active));

  return (
    <div>
      {/* Filters */}
      <div role="group" aria-label={t("filterLabel")} className="mb-10 flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = f.id === active;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(f.id)}
              className={`group/chip inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[13px] transition-all duration-200 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                on
                  ? "border-accent bg-accent-strong/15 text-fg shadow-[0_0_20px_-6px_rgb(66_135_255/0.6)]"
                  : "border-line bg-card text-muted hover:border-accent/50 hover:bg-card-hover hover:text-fg"
              }`}
            >
              <span
                className={`inline-flex size-6 items-center justify-center rounded-full transition-colors ${
                  on ? "bg-accent text-bg" : "bg-accent-strong/15 text-accent"
                }`}
              >
                {f.icon ? <SvgIcon svg={f.icon} className="size-3.5" /> : <LuLayoutGrid className="size-3.5" aria-hidden />}
              </span>
              <span className="font-display">{f.title}</span>
              <span className={`text-xs tabular-nums ${on ? "text-accent" : "text-faint"}`}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Tiles — re-keyed per filter so the survivors replay the pop-in animation */}
      <ul key={active} className="mx-auto flex max-w-[1100px] flex-wrap justify-center gap-2 sm:gap-x-2.5 sm:gap-y-3">
        {visible.map((item, i) => (
          <li
            key={item.id}
            className="relative animate-tile-in hover:z-10"
            style={{ animationDelay: `${Math.min(i * 18, 400)}ms` }}
          >
            <TechTile item={item} index={i} ariaLabel={t("openDocs", { name: item.name })} />
          </li>
        ))}
      </ul>
    </div>
  );
}

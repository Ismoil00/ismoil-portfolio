"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuLayoutGrid, LuX } from "react-icons/lu";
import { api } from "@/api/client";
import { errorMessage, fieldErrors } from "@/api/errors";
import { Picker } from "@/components/form/Picker";
import { SaveBar } from "@/components/form/SaveBar";
import { Card } from "@/components/ui/Card";
import { DragGrip, SortableList } from "@/components/ui/SortableList";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { useToast } from "@/components/ui/Toast";
import type { DevelopmentField, Instrument, TechShowcase, TechStack } from "@/types/api";

/** Filters are stored as "field:<id>" / "instrument:<id>" while editing. */
const filterKey = (f: TechShowcase["filters"][number]) => `${f.kind}:${f.id}`;
const parseKey = (key: string) => {
  const [kind, id] = key.split(":") as ["field" | "instrument", string];
  return { kind, id };
};

export function TechStackForm({
  showcase,
  fields,
  instruments,
  techs,
}: {
  showcase: TechShowcase;
  fields: DevelopmentField[];
  instruments: Instrument[];
  techs: TechStack[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState({ filters: showcase.filters.map(filterKey), techs: showcase.tech_ids });
  const [filters, setFilters] = useState(saved.filters);
  const [techIds, setTechIds] = useState(saved.techs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterInfo = useMemo(() => {
    const map = new Map<string, { label: string; group: string; icon: string | null }>();
    fields.forEach((f) => map.set(`field:${f.id}`, { label: f.name.en, group: "Development field", icon: f.icon_svg }));
    instruments.forEach((i) => map.set(`instrument:${i.id}`, { label: i.name.en, group: "Instrument", icon: i.icon_svg }));
    return map;
  }, [fields, instruments]);
  const techById = useMemo(() => new Map(techs.map((t) => [t.id, t])), [techs]);

  const dirty = JSON.stringify(filters) !== JSON.stringify(saved.filters) || JSON.stringify(techIds) !== JSON.stringify(saved.techs);

  const filterOptions = [...filterInfo.entries()].map(([value, info]) => ({
    value,
    label: info.label,
    note: info.group,
    icon: info.icon ? <SvgIcon svg={info.icon} className="size-4 text-accent" /> : undefined,
  }));
  const techOptions = techs.map((t) => ({ value: t.id, label: t.name, icon: <SvgIcon svg={t.icon_svg} color={t.color} className="size-4" /> }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (techIds.length === 0) {
      setError("Pick at least one technology.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.put<TechShowcase>("/admin/tech-showcase", { filters: filters.map(parseKey), tech_ids: techIds });
      const next = { filters: data.filters.map(filterKey), techs: data.tech_ids };
      setSaved(next);
      setFilters(next.filters);
      setTechIds(next.techs);
      toast("Tech stack saved.");
      router.refresh();
    } catch (err) {
      const found = Object.values(fieldErrors(err));
      setError(found[0] ?? errorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-6">
      <Card
        title="Filters"
        description="The buttons above the tiles. “All” is always first and isn't listed here. With no filters, the site shows only “All”."
      >
        <Picker multiple options={filterOptions} value={filters} onChange={setFilters} placeholder="Choose filters…" emptyText="Add development fields or instruments on the Selectors page first." />
        {filters.length > 0 && (
          <SortableList
            items={filters.map((id) => ({ id }))}
            onReorder={setFilters}
            className="mt-4 flex flex-wrap gap-2"
            layout="grid"
            renderItem={({ id }, handle) => {
              const info = filterInfo.get(id);
              return (
                <span className="flex items-center gap-1 rounded-full border border-line bg-card py-1 pl-1 pr-2 text-sm">
                  <DragGrip handle={handle} />
                  {info?.icon ? <SvgIcon svg={info.icon} className="size-4 text-accent" /> : <LuLayoutGrid className="size-4 text-accent" />}
                  <span className="ml-1">{info?.label ?? "Removed"}</span>
                  <button type="button" onClick={() => setFilters((list) => list.filter((f) => f !== id))} aria-label={`Remove ${info?.label}`} className="ml-1 grid size-6 place-items-center rounded-full text-faint hover:bg-tint/10 hover:text-fg">
                    <LuX className="size-3.5" />
                  </button>
                </span>
              );
            }}
          />
        )}
      </Card>

      <Card
        title="Technologies"
        description={
          <>
            The tiles, in this order — {techIds.length} shown. Each tile appears under the filters of its development fields and instruments (set on the{" "}
            <Link href="/selectors?kind=tech-stacks" className="text-accent hover:underline">
              Selectors page
            </Link>
            ).
          </>
        }
      >
        <Picker multiple options={techOptions} value={techIds} onChange={setTechIds} placeholder="Choose technologies…" emptyText="Add technologies on the Selectors page first." invalid={Boolean(error) && techIds.length === 0} />
        {techIds.length > 0 && (
          <SortableList
            items={techIds.map((id) => ({ id }))}
            onReorder={setTechIds}
            layout="grid"
            className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2"
            renderItem={({ id }, handle) => {
              const tech = techById.get(id);
              return (
                <div className="group relative flex h-full flex-col items-center gap-2 rounded-xl border border-line bg-card px-2 pb-3 pt-2 text-center">
                  <div className="flex w-full items-center justify-between">
                    <DragGrip handle={handle} />
                    <button type="button" onClick={() => setTechIds((list) => list.filter((t) => t !== id))} aria-label={`Remove ${tech?.name}`} className="grid size-7 place-items-center rounded-full text-faint opacity-0 transition-opacity hover:bg-tint/10 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100">
                      <LuX className="size-3.5" />
                    </button>
                  </div>
                  {tech && <SvgIcon svg={tech.icon_svg} color={tech.color} className="size-8" />}
                  <span className="line-clamp-2 text-xs text-muted">{tech?.name ?? "Removed"}</span>
                </div>
              );
            }}
          />
        )}
      </Card>

      <SaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        onDiscard={() => {
          setFilters(saved.filters);
          setTechIds(saved.techs);
          setError(null);
        }}
      />
    </form>
  );
}

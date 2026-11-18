"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LuExternalLink, LuPencil, LuPlus, LuSearch, LuTrash2, LuX } from "react-icons/lu";
import { errorMessage } from "@/api/errors";
import { deleteSelector, reorderSelector } from "@/api/selectors.api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { DragGrip, SortableList } from "@/components/ui/SortableList";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { useToast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import type { AnySelectorItem, DevelopmentField, Instrument, SelectorKind, TechStack } from "@/types/api";
import { describeUsage, kindInfo, kinds } from "./kinds";
import { SelectorForm } from "./SelectorForm";

type Editing = { item: AnySelectorItem | null } | null;
type Sort = "custom" | "asc" | "desc";

const SORTS: { value: Sort; label: string; title: string }[] = [
  { value: "custom", label: "Your order", title: "The order you set by dragging (used by the dropdowns and the site)" },
  { value: "asc", label: "A–Z", title: "By name, A to Z" },
  { value: "desc", label: "Z–A", title: "By name, Z to A" },
];

/** Every name an item goes by: one for brands, three (EN / RU / TG) for the rest. */
const namesOf = (item: AnySelectorItem) => (typeof item.name === "string" ? [item.name] : Object.values(item.name));

export function SelectorsView({
  kind,
  items: initialItems,
  fields,
  instruments,
}: {
  kind: SelectorKind;
  items: AnySelectorItem[];
  fields: DevelopmentField[];
  instruments: Instrument[];
}) {
  const toast = useToast();
  const info = kindInfo(kind);
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AnySelectorItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("custom");

  // Search and sort only change what is shown; dragging (which saves the order) works on the full
  // list in your own order, so it's off while either is in use.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q ? items.filter((item) => namesOf(item).some((name) => name.toLowerCase().includes(q))) : items;
    if (sort === "custom") return found;
    const sorted = [...found].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "en", { sensitivity: "base", numeric: true }));
    return sort === "desc" ? sorted.reverse() : sorted;
  }, [items, query, sort]);
  const draggable = sort === "custom" && !query.trim();

  async function reorder(ids: string[]) {
    const previous = items;
    setItems(ids.map((id) => items.find((i) => i.id === id)!));
    try {
      await reorderSelector(kind, ids);
    } catch (error) {
      setItems(previous);
      toast(errorMessage(error, "Couldn't save the new order."), "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteSelector(kind, deleting.id);
      setItems((list) => list.filter((i) => i.id !== deleting.id));
      toast(`Deleted “${nameOf(deleting)}”.`);
      setDeleting(null);
    } catch (error) {
      toast(errorMessage(error, "Couldn't delete it."), "error");
    } finally {
      setBusy(false);
    }
  }

  function saved(item: AnySelectorItem) {
    setItems((list) => (list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]));
    toast(editing?.item ? "Saved." : `Added “${nameOf(item)}”.`);
    setEditing(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
      <nav aria-label="Selector lists" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {kinds.map((k) => (
          <Link
            key={k.kind}
            href={`/selectors?kind=${k.kind}`}
            aria-current={k.kind === kind ? "page" : undefined}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-sm transition-colors ${
              k.kind === kind ? "bg-accent/12 font-medium text-accent" : "text-muted hover:bg-tint/5 hover:text-fg"
            }`}
          >
            {k.label}
          </Link>
        ))}
      </nav>

      <Card
        title={info.label}
        description={info.description}
        actions={
          <Button icon={<LuPlus className="size-4" />} onClick={() => setEditing({ item: null })}>
            Add {info.singular}
          </Button>
        }
      >
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
            <p className="text-sm text-subtle">Nothing here yet.</p>
            <Button className="mt-4" variant="secondary" size="sm" icon={<LuPlus className="size-3.5" />} onClick={() => setEditing({ item: null })}>
              Add the first {info.singular}
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="relative min-w-56 flex-1">
                <span className="sr-only">Search {info.label.toLowerCase()}</span>
                <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={typeof items[0].name === "string" ? "Search by name" : "Search by name (EN, RU or TG)"}
                  className="w-full rounded-xl border border-line bg-tint/[0.03] py-2.5 pl-10 pr-9 text-sm text-fg placeholder:text-faint transition-[border-color,box-shadow] hover:border-line-strong focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear the search"
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-faint hover:bg-tint/[0.06] hover:text-fg"
                  >
                    <LuX className="size-3.5" />
                  </button>
                )}
              </label>
              <div role="group" aria-label="Sort by name" className="flex shrink-0 rounded-xl border border-line bg-tint/[0.03] p-1">
                {SORTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSort(option.value)}
                    aria-pressed={sort === option.value}
                    title={option.title}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      sort === option.value ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-subtle">No {info.label.toLowerCase()} match “{query.trim()}”.</p>
            ) : draggable ? (
              <SortableList
                items={items}
                onReorder={reorder}
                className="divide-y divide-line overflow-hidden rounded-xl border border-line"
                renderItem={(item, handle) => (
                  <Row
                    kind={kind}
                    item={item}
                    fields={fields}
                    instruments={instruments}
                    grip={<DragGrip handle={handle} />}
                    onEdit={() => setEditing({ item })}
                    onDelete={() => setDeleting(item)}
                  />
                )}
              />
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {shown.map((item) => (
                  <li key={item.id}>
                    <Row
                      kind={kind}
                      item={item}
                      fields={fields}
                      instruments={instruments}
                      grip={<span className="w-8 shrink-0" aria-hidden />}
                      onEdit={() => setEditing({ item })}
                      onDelete={() => setDeleting(item)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2.5 text-xs text-faint">
              {draggable
                ? `${items.length} in all. Drag the handle to change the order.`
                : `Showing ${shown.length} of ${items.length}. Dragging works in “Your order” without a search.`}
            </p>
          </>
        )}
      </Card>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.item ? `Edit ${info.singular}` : `Add ${info.singular}`}
        size={kind === "tech-stacks" ? "lg" : "md"}
      >
        {editing && (
          <SelectorForm
            kind={kind}
            item={editing.item}
            fields={fields}
            instruments={instruments}
            onSaved={saved}
            onCancel={() => setEditing(null)}
          />
        )}
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={`Delete ${info.singular}?`} size="sm">
        <p className="text-sm text-muted">
          “{deleting && nameOf(deleting)}” will be removed. This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} icon={<LuTrash2 className="size-4" />} onClick={confirmDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function nameOf(item: AnySelectorItem): string {
  return typeof item.name === "string" ? item.name : item.name.en;
}

function Row({
  kind,
  item,
  fields,
  instruments,
  grip,
  onEdit,
  onDelete,
}: {
  kind: SelectorKind;
  item: AnySelectorItem;
  fields: DevelopmentField[];
  instruments: Instrument[];
  grip: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const any = item as unknown as Record<string, unknown>;
  const icon = any.icon_svg as string | null | undefined;
  const color = any.color as string | null | undefined;
  const logo = any.logo as { url: string } | null | undefined;
  const site = (any.website_url ?? any.docs_url) as string | null | undefined;
  const inUse = Object.keys(item.usage).length > 0;
  const usageText = describeUsage(item.usage);

  const categories =
    kind === "tech-stacks"
      ? [
          ...(item as TechStack).field_ids.map((id) => fields.find((f) => f.id === id)?.name.en),
          ...(item as TechStack).instrument_ids.map((id) => instruments.find((f) => f.id === id)?.name.en),
        ].filter(Boolean)
      : [];

  return (
    <div className="flex items-center gap-3 bg-card px-2 py-2.5 transition-colors hover:bg-card-hover sm:px-3">
      {grip}
      {kind === "companies" || kind === "institutes" ? (
        <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-tint/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded logo */}
          {logo ? <img src={logo.url} alt="" className="max-h-7 max-w-7 object-contain" /> : <span className="text-[10px] text-faint">—</span>}
        </div>
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-tint/[0.03]">
          {icon ? <SvgIcon svg={icon} color={color ?? undefined} className={`size-5 ${color ? "" : "text-accent"}`} /> : <span className="text-[10px] text-faint">—</span>}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nameOf(item)}</p>
        <p className="truncate text-xs text-subtle">
          {typeof item.name !== "string" && (
            <span>
              {item.name.ru} · {item.name.tg}
            </span>
          )}
          {categories.length > 0 && <span>{categories.join(", ")}</span>}
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-1 text-faint hover:text-accent">
              {new URL(site).hostname.replace(/^www\./, "")} <LuExternalLink className="size-3" />
            </a>
          )}
        </p>
      </div>

      {color && kind === "tech-stacks" && <span className="hidden size-4 shrink-0 rounded-full border border-line sm:block" style={{ background: color }} title={color} />}

      <div className="flex shrink-0 items-center">
        <button type="button" onClick={onEdit} aria-label={`Edit ${nameOf(item)}`} title="Edit" className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-tint/5 hover:text-accent">
          <LuPencil className="size-4" />
        </button>
        {inUse ? (
          // To the left: a bubble above the first row would be cut off by the list's rounded frame.
          <Tooltip label={`In use: ${usageText}. Remove it there first.`} side="left">
            <button type="button" aria-disabled="true" aria-label={`Can't delete ${nameOf(item)}: in use`} className="grid size-9 place-items-center rounded-full text-faint opacity-50">
              <LuTrash2 className="size-4" />
            </button>
          </Tooltip>
        ) : (
          <button type="button" onClick={onDelete} aria-label={`Delete ${nameOf(item)}`} title="Delete" className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger">
            <LuTrash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

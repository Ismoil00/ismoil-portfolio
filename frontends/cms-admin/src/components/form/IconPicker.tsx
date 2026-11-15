"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { LuImageUp, LuLibrary, LuSearch, LuTrash2 } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { SvgIcon } from "@/components/ui/SvgIcon";

type IconSet = "brands" | "generic";
type IconEntry = [name: string, Icon: ComponentType<{ className?: string }>];

const MAX_SVG_BYTES = 128 * 1024;
const MAX_RESULTS = 160;

/** "SiNextdotjs" → "Nextdotjs", "LuDatabaseZap" → "Database Zap". */
const displayName = (name: string) => name.slice(2).replace(/([a-z])([A-Z])/g, "$1 $2");

async function loadSet(set: IconSet): Promise<IconEntry[]> {
  // Loaded only when the library opens: thousands of icons stay out of the page's normal code.
  const mod: Record<string, unknown> = set === "brands" ? await import("react-icons/si") : await import("react-icons/lu");
  const prefix = set === "brands" ? "Si" : "Lu";
  return Object.entries(mod).filter(([name]) => name.startsWith(prefix)) as IconEntry[];
}

/**
 * Icon of a selector item, stored as SVG text. Pick one from a built-in library (Simple Icons brand
 * logos, Lucide outline icons) or upload an .svg; the backend cleans it. Icons are single-color:
 * the site paints them (brand color, accent, theme).
 */
export function IconPicker({
  value,
  onChange,
  color,
  required,
  invalid,
}: {
  value: string | null;
  onChange: (svg: string | null) => void;
  color?: string | null;
  required?: boolean;
  invalid?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_SVG_BYTES) return setUploadError("The SVG must be under 128 KB.");
    const text = await file.text();
    if (!/<svg[\s>]/i.test(text)) return setUploadError("This file isn't an SVG.");
    onChange(text);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          aria-invalid={invalid || undefined}
          className="grid size-14 shrink-0 place-items-center rounded-xl border border-dashed border-line-strong bg-tint/[0.03] aria-[invalid=true]:border-danger/70"
        >
          {value ? <SvgIcon svg={value} color={color} className="size-7" title="Selected icon" /> : <span className="text-xs text-faint">None</span>}
        </div>
        <Button size="sm" variant="secondary" icon={<LuLibrary className="size-3.5" />} onClick={() => setLibraryOpen(true)}>
          Choose from library
        </Button>
        <Button size="sm" variant="secondary" icon={<LuImageUp className="size-3.5" />} onClick={() => fileRef.current?.click()}>
          Upload .svg
        </Button>
        {value && !required && (
          <Button size="sm" variant="ghost" icon={<LuTrash2 className="size-3.5" />} onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {uploadError && <p className="mt-1.5 text-xs text-danger">{uploadError}</p>}
      {/* Mounted only while open, so every visit starts with an empty search. */}
      {libraryOpen && (
      <IconLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPick={(svg) => {
          onChange(svg);
          setLibraryOpen(false);
        }}
      />
      )}
    </div>
  );
}

function IconLibrary({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (svg: string) => void }) {
  const [set, setSet] = useState<IconSet>("brands");
  const [icons, setIcons] = useState<Partial<Record<IconSet, IconEntry[]>>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || icons[set]) return;
    let cancelled = false;
    loadSet(set).then((list) => !cancelled && setIcons((all) => ({ ...all, [set]: list })));
    return () => {
      cancelled = true;
    };
  }, [open, set, icons]);

  const list = icons[set];
  const matches = useMemo(() => {
    if (!list) return [];
    const q = query.trim().toLowerCase().replace(/[\s.-]/g, "");
    return (q ? list.filter(([name]) => name.toLowerCase().includes(q)) : list).slice(0, MAX_RESULTS);
  }, [list, query]);

  return (
    <Dialog open={open} onClose={onClose} title="Icon library" description="Brand logos from Simple Icons, generic icons from Lucide." size="lg">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-line p-0.5">
          {(["brands", "generic"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSet(key)}
              aria-pressed={set === key}
              className={`h-8 rounded-full px-3.5 text-xs font-medium transition-colors ${
                set === key ? "bg-accent text-bg light:text-white" : "text-muted hover:text-fg"
              }`}
            >
              {key === "brands" ? "Brand logos" : "Generic icons"}
            </button>
          ))}
        </div>
        <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-line px-3 focus-within:border-accent/70">
          <LuSearch className="size-4 text-faint" />
          <input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={set === "brands" ? "Search brands: python, docker, figma…" : "Search icons: database, globe, shield…"}
            className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </label>
      </div>
      <div className="min-h-[26rem]">
      {!list ? (
        <div className="grid h-64 place-items-center text-subtle">
          <Spinner />
        </div>
      ) : matches.length === 0 ? (
        <p className="py-16 text-center text-sm text-subtle">No icons match “{query}”. Try another word, or upload an .svg.</p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
            {matches.map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                title={displayName(name)}
                onClick={(e) => {
                  const svg = e.currentTarget.querySelector("svg");
                  if (svg) onPick(svg.outerHTML);
                }}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-line px-1 py-3 text-muted transition-[color,border-color,background-color] duration-150 hover:border-accent/60 hover:bg-accent/[0.06] hover:text-accent"
              >
                <Icon className="size-6" />
                <span className="w-full truncate text-center text-[10px] leading-tight">{displayName(name)}</span>
              </button>
            ))}
          </div>
          {matches.length === MAX_RESULTS && (
            <p className="mt-3 text-center text-xs text-faint">Showing the first {MAX_RESULTS}. Type to narrow it down.</p>
          )}
        </>
      )}
      </div>
    </Dialog>
  );
}

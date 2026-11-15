"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LuExternalLink, LuGlobe, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { api } from "@/api/client";
import { errorMessage, fieldErrors } from "@/api/errors";
import { Field, TextInput } from "@/components/form/Field";
import { Picker } from "@/components/form/Picker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { DragGrip, SortableList } from "@/components/ui/SortableList";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { useToast } from "@/components/ui/Toast";
import type { LinkPlatform, OtherLink } from "@/types/api";

function PlatformIcon({ icon, color, className = "size-5" }: { icon: string | null; color: string | null; className?: string }) {
  return icon ? (
    <SvgIcon svg={icon} color={color} className={`${className} ${color ? "" : "text-accent"}`} />
  ) : (
    <LuGlobe className={`${className} text-accent`} aria-hidden />
  );
}

/** "Other links": any number of links, each with an icon + name from the Link platforms selector. */
export function OtherLinksCard({ links: initial, platforms }: { links: OtherLink[]; platforms: LinkPlatform[] }) {
  const toast = useToast();
  const [links, setLinks] = useState(initial);
  const [editing, setEditing] = useState<{ link: OtherLink | null } | null>(null);

  async function reorder(ids: string[]) {
    const previous = links;
    setLinks(ids.map((id) => links.find((l) => l.id === id)!));
    try {
      await api.put("/admin/other-links/order", { ids });
    } catch (error) {
      setLinks(previous);
      toast(errorMessage(error, "Couldn't save the new order."), "error");
    }
  }

  async function remove(link: OtherLink) {
    if (!window.confirm(`Remove the ${link.platform.name} link?`)) return;
    try {
      await api.delete(`/admin/other-links/${link.id}`);
      setLinks((list) => list.filter((l) => l.id !== link.id));
      toast("Link removed.");
    } catch (error) {
      toast(errorMessage(error, "Couldn't remove the link."), "error");
    }
  }

  return (
    <Card
      title="Other links"
      description="The “Other links” tile (and the last icon of the side rail) opens these. Drag to reorder."
      actions={
        <Button size="sm" icon={<LuPlus className="size-3.5" />} onClick={() => setEditing({ link: null })} disabled={!platforms.length}>
          Add link
        </Button>
      }
    >
      {!platforms.length && (
        <p className="mb-4 text-sm text-subtle">
          Add link platforms (icon + name) on the{" "}
          <Link href="/selectors?kind=link-platforms" className="text-accent hover:underline">
            Selectors page
          </Link>{" "}
          first.
        </p>
      )}
      {links.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-6 py-8 text-center text-sm text-subtle">
          No other links yet — the tile is hidden on the site until you add one.
        </p>
      ) : (
        <SortableList
          items={links}
          onReorder={reorder}
          className="divide-y divide-line overflow-hidden rounded-xl border border-line"
          renderItem={(link, handle) => (
            <div className="flex items-center gap-3 bg-card px-2 py-2.5 hover:bg-card-hover sm:px-3">
              <DragGrip handle={handle} />
              <div className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-tint/[0.03]">
                <PlatformIcon icon={link.platform.icon_svg} color={link.platform.color} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{link.platform.name}</p>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-subtle hover:text-accent">
                  <span className="truncate">{link.url}</span> <LuExternalLink className="size-3 shrink-0" />
                </a>
              </div>
              <button type="button" onClick={() => setEditing({ link })} aria-label={`Edit the ${link.platform.name} link`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-tint/5 hover:text-accent">
                <LuPencil className="size-4" />
              </button>
              <button type="button" onClick={() => remove(link)} aria-label={`Remove the ${link.platform.name} link`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger">
                <LuTrash2 className="size-4" />
              </button>
            </div>
          )}
        />
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.link ? "Edit link" : "Add link"} size="sm">
        {editing && (
          <LinkForm
            link={editing.link}
            platforms={platforms}
            onCancel={() => setEditing(null)}
            onSaved={(saved) => {
              setLinks((list) => (list.some((l) => l.id === saved.id) ? list.map((l) => (l.id === saved.id ? saved : l)) : [...list, saved]));
              toast(editing.link ? "Link saved." : "Link added.");
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </Card>
  );
}

function LinkForm({
  link,
  platforms,
  onSaved,
  onCancel,
}: {
  link: OtherLink | null;
  platforms: LinkPlatform[];
  onSaved: (link: OtherLink) => void;
  onCancel: () => void;
}) {
  const [platformId, setPlatformId] = useState<string | null>(link?.platform.id ?? null);
  const [url, setUrl] = useState(link?.url ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!platformId) found.platform_id = "Pick a platform";
    if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url.trim())) found.url = "Enter a full link starting with https://";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const body = { platform_id: platformId, url: url.trim() };
      const { data } = link ? await api.put<OtherLink>(`/admin/other-links/${link.id}`, body) : await api.post<OtherLink>("/admin/other-links", body);
      onSaved(data);
    } catch (error) {
      const server = fieldErrors(error);
      setErrors(Object.keys(server).length ? server : { _form: errorMessage(error) });
      setSaving(false);
    }
  }

  const options = platforms.map((p) => ({ value: p.id, label: p.name, icon: <PlatformIcon icon={p.icon_svg} color={p.color} className="size-4" /> }));

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Platform" htmlFor="link-platform" required error={errors.platform_id} hint="Icon and name come from the Link platforms selector.">
        <Picker id="link-platform" options={options} value={platformId} onChange={setPlatformId} placeholder="Pick a platform" invalid={Boolean(errors.platform_id)} />
      </Field>
      <Field label="Link" htmlFor="link-url" required error={errors.url}>
        <TextInput id="link-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" invalid={Boolean(errors.url)} />
      </Field>
      {errors._form && <p className="text-sm text-danger">{errors._form}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {link ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}

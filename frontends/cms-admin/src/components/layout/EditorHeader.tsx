"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuArrowLeft, LuTrash2 } from "react-icons/lu";
import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

/** Top of an editor page: back to the list, the title, and Delete for an existing record. */
export function EditorHeader({
  backHref,
  backLabel,
  title,
  deleteUrl,
  itemName,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  /** API path to DELETE; omitted for new records. */
  deleteUrl?: string;
  itemName?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!deleteUrl) return;
    setBusy(true);
    try {
      await api.delete(deleteUrl);
      toast(`Deleted${itemName ? ` “${itemName}”` : ""}.`);
      router.push(backHref);
      router.refresh();
    } catch (error) {
      toast(errorMessage(error, "Couldn't delete it."), "error");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <header className="mb-8">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-subtle transition-colors hover:text-accent">
        <LuArrowLeft className="size-4" /> {backLabel}
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {deleteUrl && (
          <Button variant="danger" size="sm" icon={<LuTrash2 className="size-3.5" />} onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
      </div>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Delete for good?" size="sm">
        <p className="text-sm text-muted">
          {itemName ? `“${itemName}”` : "This"} will be removed from the site, with its files. This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} icon={<LuTrash2 className="size-4" />} onClick={remove}>
            Delete
          </Button>
        </div>
      </Dialog>
    </header>
  );
}

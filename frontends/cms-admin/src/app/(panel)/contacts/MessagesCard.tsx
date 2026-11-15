"use client";

import { useState } from "react";
import { LuInbox, LuMail, LuPhone, LuTrash2 } from "react-icons/lu";
import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { ContactMessage, Page } from "@/types/api";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Where to reply: an email opens the mail app, a phone number opens WhatsApp. */
function replyLink(contact: string) {
  return contact.includes("@") ? `mailto:${contact}` : `https://wa.me/${contact.replace(/\D/g, "")}`;
}

/** Messages sent through the public site's contact form, newest first. */
export function MessagesCard({ initial, pageSize }: { initial: Page<ContactMessage>; pageSize: number }) {
  const toast = useToast();
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const { data } = await api.get<Page<ContactMessage>>("/admin/messages", { params: { offset: items.length, limit: pageSize } });
      setItems((list) => [...list, ...data.items.filter((m) => !list.some((x) => x.id === m.id))]);
      setTotal(data.total);
    } catch (error) {
      toast(errorMessage(error, "Couldn't load more messages."), "error");
    } finally {
      setLoading(false);
    }
  }

  async function remove(message: ContactMessage) {
    if (!window.confirm(`Delete the message from ${message.name}? This can't be undone.`)) return;
    try {
      await api.delete(`/admin/messages/${message.id}`);
      setItems((list) => list.filter((m) => m.id !== message.id));
      setTotal((n) => n - 1);
      toast("Message deleted.");
    } catch (error) {
      toast(errorMessage(error, "Couldn't delete the message."), "error");
    }
  }

  return (
    <Card title="Messages" description={`Sent through the contact form on the site · ${total} in total`}>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-subtle">
          <LuInbox className="size-6 text-faint" />
          No messages yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line bg-tint/[0.02] text-xs uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-2 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((m) => (
                <tr key={m.id} className="align-top transition-colors hover:bg-card-hover">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    <a href={replyLink(m.contact)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">
                      {m.contact.includes("@") ? <LuMail className="size-3.5" /> : <LuPhone className="size-3.5" />}
                      {m.contact}
                    </a>
                  </td>
                  <td className="max-w-md whitespace-pre-line px-4 py-3 text-muted">{m.message}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-subtle">{dateFormat.format(new Date(m.created_at))}</td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => remove(m)} aria-label={`Delete the message from ${m.name}`} title="Delete" className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger">
                      <LuTrash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length < total && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" loading={loading} onClick={loadMore}>
            Show more ({total - items.length} left)
          </Button>
        </div>
      )}
    </Card>
  );
}

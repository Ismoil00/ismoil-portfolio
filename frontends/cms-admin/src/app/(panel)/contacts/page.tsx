import type { Metadata } from "next";
import { serverGet } from "@/api/server";
import { PageHeader } from "@/components/layout/PageHeader";
import type { ContactMessage, Contacts, LinkPlatform, OtherLink, Page } from "@/types/api";
import { ContactsForm } from "./ContactsForm";
import { MessagesCard } from "./MessagesCard";
import { OtherLinksCard } from "./OtherLinksCard";

export const metadata: Metadata = { title: "Contacts" };

const MESSAGES_PAGE = 20;

export default async function ContactsPage() {
  const [contacts, links, platforms, messages] = await Promise.all([
    serverGet<Contacts | null>("/admin/contacts"),
    serverGet<OtherLink[]>("/admin/other-links"),
    serverGet<LinkPlatform[]>("/admin/selectors/link-platforms"),
    serverGet<Page<ContactMessage>>("/admin/messages", { offset: "0", limit: String(MESSAGES_PAGE) }),
  ]);

  return (
    <>
      <PageHeader title="Contacts" description="How people reach you, your other links, and the messages sent through the site's form." />
      <div className="space-y-6">
        <ContactsForm contacts={contacts} />
        <OtherLinksCard links={links} platforms={platforms} />
        <MessagesCard initial={messages} pageSize={MESSAGES_PAGE} />
      </div>
    </>
  );
}

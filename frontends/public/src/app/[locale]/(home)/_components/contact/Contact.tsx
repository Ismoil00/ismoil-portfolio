import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getProfile } from "@/api/content.api";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { ContactForm } from "./ContactForm";
import { OtherLinks } from "@/components/other-links/OtherLinks";
import { contactTileClass } from "@/components/ui/contact-styles";

export async function Contact({ locale }: { locale: Locale }) {
  const [profile, t, tc] = await Promise.all([
    getProfile(locale),
    getTranslations({ locale, namespace: "sections.contact" }),
    getTranslations({ locale, namespace: "contact" }),
  ]);

  return (
    <Section id="contact" eyebrow={t("eyebrow")} title={t("title")} lead={tc("question")}>
      {/* Two columns, each "label + block". From lg the columns share the grid's rows (subgrid),
          so both labels sit on one line and both blocks start on one line, even if a label wraps. */}
      <div className="grid gap-y-10 lg:grid-cols-[1fr_1.2fr] lg:grid-rows-[auto_auto] lg:gap-x-12 lg:gap-y-0">
        <Reveal className="lg:row-span-2 lg:grid lg:grid-rows-subgrid">
          <p className="mb-3 text-sm text-subtle">{tc("directly")}</p>
          <div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Each tile starts a conversation: the visitor's mail app (mailto, me as recipient),
                  a Telegram / WhatsApp chat, or my LinkedIn profile with its "Message" button. */}
              {profile.contacts.map((c) => {
                const isMail = c.url.startsWith("mailto:");
                return (
                  <li key={c.id}>
                    <a
                      href={c.url}
                      {...(isMail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                      className={contactTileClass}
                    >
                      <SocialIcon id={c.id} brand className="size-5 shrink-0 text-accent" />
                      <span className="min-w-0">
                        <span className="block font-display text-sm text-fg">{c.label}</span>
                        <span className="block text-xs text-subtle [overflow-wrap:anywhere]">
                          <BreakableHandle text={c.handle} />
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
              {profile.otherLinks.length > 0 && (
                <li className="sm:col-span-2">
                  <OtherLinks links={profile.otherLinks} />
                </li>
              )}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={120} className="lg:row-span-2 lg:grid lg:grid-rows-subgrid">
          <p className="mb-3 text-sm text-subtle">{tc("formLead")}</p>
          <ContactForm />
        </Reveal>
      </div>
    </Section>
  );
}

/** In a narrow tile an email address wraps before the "@" ("name" / "@gmail.com"), not mid-word. */
function BreakableHandle({ text }: { text: string }) {
  const at = text.indexOf("@");
  if (at <= 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <wbr />
      {text.slice(at)}
    </>
  );
}

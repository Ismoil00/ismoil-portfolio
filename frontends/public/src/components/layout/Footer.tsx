import { getTranslations } from "next-intl/server";
import { LuArrowUp } from "react-icons/lu";
import { Container } from "@/components/ui/Container";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { Tooltip } from "@/components/ui/Tooltip";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { Link } from "@/i18n/navigation";
import type { Profile } from "@/types/content";

export async function Footer({ profile }: { profile: Profile }) {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line py-6">
      {/* One row from md: copyright | "back to top" (exactly centered) | contact icons.
          Phones stack them: button, copyright, icons. */}
      <Container className="flex flex-col items-center gap-4 text-center md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6 md:text-left">
        <div className="flex flex-col items-center gap-1 md:items-start">
          <p className="font-display text-fg">
            © {year} {profile.fullName}. {t("rights")}
          </p>
          {/* Cookie choices can be changed at any time (consent rules). */}
          <p className="flex gap-3 text-sm text-muted">
            <CookieSettingsButton label={t("cookieSettings")} className="underline-offset-2 hover:text-accent hover:underline" />
            <Link href="/cookies" className="underline-offset-2 hover:text-accent hover:underline">
              {t("cookiePolicy")}
            </Link>
          </p>
        </div>

        <a
          href="#top"
          aria-label={t("top")}
          className="order-first inline-flex size-10 items-center justify-center rounded-full bg-accent text-bg transition-transform hover:-translate-y-0.5 md:order-none"
        >
          <LuArrowUp className="size-4" />
        </a>

        {/* The same ways to reach me as the Contact section: mail app, Telegram, WhatsApp, LinkedIn. */}
        <ul className="flex items-center gap-2 md:justify-self-end">
          {profile.contacts.map((c) => (
            <li key={c.id}>
              {/* Hover / keyboard focus shows the platform name above the icon. */}
              <Tooltip label={c.label} align="center">
                <a
                  href={c.url}
                  {...(c.url.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                  aria-label={c.label}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <SocialIcon id={c.id} className="size-4" />
                </a>
              </Tooltip>
            </li>
          ))}
        </ul>
      </Container>
    </footer>
  );
}

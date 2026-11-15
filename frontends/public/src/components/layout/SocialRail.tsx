import type { Profile } from "@/types/content";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { Tooltip } from "@/components/ui/Tooltip";
import { railButtonClass } from "@/components/ui/contact-styles";
import { OtherLinks } from "@/components/other-links/OtherLinks";

/**
 * Vertical rail fixed to the screen's left edge on every page: Email, Telegram, WhatsApp,
 * LinkedIn (in their own brand colors) and "Other links", which opens its circles to the right.
 *
 * Shown from 1240px wide: that is where the page's content column (max-w-6xl, 2rem padding)
 * still keeps ~24px clear of the icons, even with a classic 15px scrollbar. Below that the rail
 * would sit on top of the content, so it is hidden (the same links are in Contact and the footer).
 */
export function SocialRail({ profile }: { profile: Profile }) {
  return (
    <div className="fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 min-[1240px]:block">
      <ul className="flex flex-col items-center gap-1">
        {profile.contacts.map((c) => (
          <li key={c.id}>
            <Tooltip label={c.label} side="right">
              <a
                href={c.url}
                {...(c.url.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                aria-label={c.label}
                className={railButtonClass}
              >
                <SocialIcon id={c.id} brand className="size-5 text-accent" />
              </a>
            </Tooltip>
          </li>
        ))}
        {profile.otherLinks.length > 0 && (
          <li>
            <OtherLinks links={profile.otherLinks} variant="rail" />
          </li>
        )}
        <li aria-hidden className="mt-3 h-20 w-px bg-line" />
      </ul>
    </div>
  );
}

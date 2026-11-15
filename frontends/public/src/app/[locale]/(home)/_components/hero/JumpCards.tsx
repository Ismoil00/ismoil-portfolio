import { LuBriefcaseBusiness, LuLayers } from "react-icons/lu";
import type { IconType } from "react-icons";
import { Spotlight } from "@/components/ui/Spotlight";
import { LongArrowDown } from "./LongArrowDown";

export interface JumpCard {
  href: `#${string}`;
  title: string;
  hint: string;
  icon: "work" | "experience";
}

const icons: Record<JumpCard["icon"], IconType> = { work: LuLayers, experience: LuBriefcaseBusiness };

/**
 * Two floating shortcut cards so a recruiter can jump straight to projects / experience.
 * Large screens: stacked and staggered on the right of the hero text.
 * Small screens: same grid as the stats cards below them.
 *
 * Layers: the <a> floats (and pauses on hover so it's easy to hit);
 * the Spotlight inside it is the visible card with the mouse-follow light and shadow.
 */
export function JumpCards({ cards, label }: { cards: JumpCard[]; label: string }) {
  return (
    // Below lg: full-width 2-column grid, like the stats cards and every other section's boxes.
    <nav aria-label={label} className="grid grid-cols-2 gap-3 sm:gap-4 lg:flex lg:flex-col lg:gap-6">
      {cards.map((card, i) => {
        const Icon = icons[card.icon];
        return (
          <a
            key={card.href}
            href={card.href}
            className={`group block animate-bob rounded-2xl hover:[animation-play-state:paused] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent focus-visible:[animation-play-state:paused] lg:w-64 lg:rounded-3xl ${
              i % 2 ? "lg:ml-12" : "lg:mr-12"
            }`}
            // Second card floats out of phase with the first.
            style={{ animationDelay: `${i * -3}s` }}
          >
            <Spotlight
              reactiveShadow
              size={260}
              className="h-full rounded-2xl border border-line bg-card p-4 backdrop-blur-md hover:border-accent/50 sm:p-5 lg:rounded-3xl"
            >
              {/* Content on the left, a bare arrow on the right (vertically centered) pointing down. */}
              <span className="flex items-center gap-2 sm:gap-3">
                <span className="min-w-0 flex-1">
                  <span className="relative inline-flex size-10 items-center justify-center rounded-2xl bg-accent-strong/15 text-accent sm:size-11">
                    <Icon className="size-5" aria-hidden />
                    <span aria-hidden className="absolute -right-0.5 -top-0.5 flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
                    </span>
                  </span>
                  <span className="mt-4 block font-display text-lg font-semibold leading-tight text-fg sm:text-xl">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-subtle sm:text-sm">{card.hint}</span>
                </span>
                <LongArrowDown className="h-7 w-auto shrink-0 animate-nudge-lg text-muted transition-colors duration-300 group-hover:text-accent sm:h-9" />
              </span>
            </Spotlight>
          </a>
        );
      })}
    </nav>
  );
}

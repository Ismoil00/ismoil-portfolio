import type { CSSProperties } from "react";
import type { TechItem } from "@/types/content";
import { Spotlight } from "@/components/ui/Spotlight";
import { themedBrandColor } from "@/lib/brand-color";
import { SvgIcon } from "@/components/ui/SvgIcon";

/**
 * One tech-stack tile, styled like the reference site; enlarged (88×94px on desktop) so labels are readable.
 * Layers so the motions never fight over `transform`:
 *   outer (in TechGrid) — pop-in after filtering
 *   middle (here)       — gentle constant float, paused on hover
 *   link                — hover lift + scale (transform only, so neighbours never move)
 */
export function TechTile({ item, index, ariaLabel }: { item: TechItem; index: number; ariaLabel: string }) {
  return (
    <div
      className="animate-float-tile hover:[animation-play-state:paused]"
      // Spread the start points so tiles drift out of sync, like a gentle wave.
      style={{ animationDelay: `${-((index * 0.83) % 7).toFixed(2)}s` }}
    >
      <a
        href={item.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        title={item.name}
        aria-label={ariaLabel}
        style={{ "--brand": themedBrandColor(item.color) } as CSSProperties}
        // Widths fit the longest single word ("Elasticsearch") at each label size;
        // multi-word names wrap to a second line instead of being cut off.
        // The link keeps the reference-style hover (lift, scale, blue border, fixed glow shadow).
        className="group/tile block h-[82px] w-[72px] rounded-[10px] border border-line bg-card backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.08] hover:border-accent hover:bg-accent-strong/10 hover:shadow-[0_8px_30px_rgb(66_135_255/0.25)] active:translate-y-0 active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-[88px] md:w-[80px] xl:h-[94px] xl:w-[88px]"
      >
        {/* Inside it, the mouse-follow light + a directional shadow that adds to the fixed one.
            Scaled down for the small tile; the light sits behind the icon and label. */}
        <Spotlight
          reactiveShadow
          size={90}
          shadowScale={0.45}
          intensity={0.85}
          className="h-full w-full rounded-[9px]"
          contentClassName="flex h-full w-full flex-col items-center justify-center p-[5px] md:p-1.5"
        >
          <SvgIcon
            svg={item.icon}
            className="size-6 text-subtle opacity-85 transition-[color,opacity] duration-300 group-hover/tile:text-(--brand) group-hover/tile:opacity-100 md:size-[26px] xl:size-[30px]"
          />
          <span className="mt-1.5 line-clamp-2 w-full text-center text-balance text-[11px] leading-[1.15] text-fg/80 transition-colors duration-300 group-hover/tile:text-fg md:text-xs xl:text-[13px]">
            {item.name}
          </span>
        </Spotlight>
      </a>
    </div>
  );
}

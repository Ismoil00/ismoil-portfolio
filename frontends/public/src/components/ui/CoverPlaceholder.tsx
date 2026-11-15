import type { IconType } from "react-icons";
import { LuGlobe } from "react-icons/lu";
import { SvgIcon } from "./SvgIcon";

/** Branded stand-in for a missing card image: blue glow, faint grid, and an icon (dark or light per theme). */
/** `icon`: a stored SVG (product type) or an icon component; none → a globe. */
export function CoverPlaceholder({ icon }: { icon: string | IconType | null }) {
  const Icon = typeof icon === "function" ? icon : LuGlobe;
  return (
    <div
      aria-hidden
      className="relative flex size-full items-center justify-center overflow-hidden bg-[radial-gradient(120%_90%_at_70%_20%,rgb(66_135_255/0.22),transparent_60%),linear-gradient(160deg,#0f1625,#080a0f)] light:bg-[radial-gradient(120%_90%_at_70%_20%,rgb(66_135_255/0.18),transparent_60%),linear-gradient(160deg,#e8effd,#f7f9fd)]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(circle_at_center,#000,transparent_75%)] light:bg-[linear-gradient(rgb(12_19_34/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(12_19_34/0.06)_1px,transparent_1px)]" />
      {typeof icon === "string" ? (
        <SvgIcon svg={icon} className="relative size-16 text-accent/35" />
      ) : (
        <Icon className="relative size-16 text-accent/35" strokeWidth={1.25} />
      )}
    </div>
  );
}

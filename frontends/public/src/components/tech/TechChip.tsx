import type { TechRef } from "@/types/content";
import { themedBrandColor } from "@/lib/brand-color";
import { SvgIcon } from "@/components/ui/SvgIcon";

/** A technology pill with its brand icon. */
export function TechChip({ tech, size = "sm" }: { tech: TechRef; size?: "sm" | "md" }) {
  return (
    <li
      className={`inline-flex items-center rounded-full border border-line bg-tint/[0.03] text-fg/85 ${
        size === "md" ? "gap-2 px-3 py-1.5 text-sm" : "gap-1.5 px-2.5 py-1 text-xs"
      }`}
    >
      <SvgIcon svg={tech.icon} color={themedBrandColor(tech.color)} className={size === "md" ? "size-4" : "size-3.5"} />
      {tech.name}
    </li>
  );
}

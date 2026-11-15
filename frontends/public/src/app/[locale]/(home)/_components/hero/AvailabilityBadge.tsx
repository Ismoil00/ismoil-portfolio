import { useTranslations } from "next-intl";
import type { AvailabilityStatus } from "@/types/content";

/** Dot color per status; `ping` = the soft pulsing ring (not used for "not looking"). */
const dots: Record<AvailabilityStatus, { color: string; ping: boolean }> = {
  seeking: { color: "bg-emerald-400", ping: true },
  open: { color: "bg-amber-400", ping: true },
  unavailable: { color: "bg-rose-500", ping: false },
};

/** Job-search status pill in the hero (status chosen in the admin panel). */
export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  const t = useTranslations("availability");
  const dot = dots[status] ?? dots.seeking;

  return (
    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-sm text-muted">
      <span aria-hidden className="relative flex size-2">
        {dot.ping && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${dot.color}`} />}
        <span className={`relative inline-flex size-2 rounded-full ${dot.color}`} />
      </span>
      {t(status)}
    </p>
  );
}

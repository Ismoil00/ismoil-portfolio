import { useTranslations } from "next-intl";
import { LuArrowUpRight, LuBadgeCheck, LuCalendar, LuLandmark } from "react-icons/lu";
import type { Certificate } from "@/types/content";
import { Spotlight } from "@/components/ui/Spotlight";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatMonthNumeric } from "@/lib/dates";
import { CertificateThumb } from "./CertificateThumb";

/**
 * Certificate card — used on the home page and on /certificates.
 * Same frame as the project cards (edge-to-edge photo of the certificate on top), then:
 * period (month.year) · certificate name · issuing organization · "Verify certificate".
 * Hover: the experience cards' mouse-follow light and shadow.
 * The issuer and the verify button sit at the bottom, so they line up across a row
 * however long the certificate names are.
 */
export function CertificateCard({ item }: { item: Certificate }) {
  const t = useTranslations("certificates");

  const from = formatMonthNumeric(item.start);
  const period =
    item.end === null ? (
      <>
        {from} — <span className="status-live">{t("inProgress")}</span>
      </>
    ) : item.end === item.start ? (
      from
    ) : (
      `${from} — ${formatMonthNumeric(item.end)}`
    );

  return (
    <article className="h-full">
      <Spotlight
        reactiveShadow
        size={210}
        shadowScale={0.7}
        intensity={0.7}
        className="h-full rounded-2xl border border-line bg-card hover:border-accent/40"
        contentClassName="flex h-full flex-col"
      >
        <div className="relative h-48 shrink-0 overflow-hidden border-b border-line bg-bg sm:h-52">
          <CertificateThumb images={item.images} title={item.title} />
        </div>

        <div className="flex flex-1 flex-col p-6">
          <p className="flex items-center gap-2 font-display text-sm tabular-nums text-subtle">
            <LuCalendar className="size-3.5 shrink-0" aria-hidden />
            {period}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold leading-snug sm:text-xl">{item.title}</h3>

          <div className="mt-auto pt-3">
            <p className="mb-5 flex items-start gap-2 font-display text-accent">
              <LuLandmark className="mt-1 size-4 shrink-0" aria-hidden />
              {item.issuer.url ? (
                <a href={item.issuer.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-accent-soft">
                  {item.issuer.name}
                </a>
              ) : (
                item.issuer.name
              )}
            </p>
            <div className="flex min-h-14 items-center justify-center border-t border-line pt-4">
              <VerifyLink url={item.verifyUrl ?? undefined} />
            </div>
          </div>
        </div>
      </Spotlight>
    </article>
  );
}

/** Opens the issuer's verification page; shown disabled (with the reason) when there's none. */
function VerifyLink({ url }: { url?: string }) {
  const t = useTranslations("certificates");
  const base =
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-display text-sm transition-[color,background-color,border-color,transform,translate,scale] duration-200";

  if (!url) {
    return (
      <Tooltip label={t("verifyUnavailable")} align="center">
        <button
          type="button"
          aria-disabled="true"
          aria-label={`${t("verify")} — ${t("verifyUnavailable")}`}
          className={`${base} border-dashed border-line text-faint`}
        >
          <LuBadgeCheck className="size-4" aria-hidden />
          {t("verify")}
        </button>
      </Tooltip>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t("verify")} — ${t("verifyHint")}`}
      className={`group/verify ${base} border-accent/40 text-accent hover:border-accent hover:bg-accent/10 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      <LuBadgeCheck className="size-4" aria-hidden />
      {t("verify")}
      <LuArrowUpRight
        className="size-3.5 transition-transform group-hover/verify:-translate-y-0.5 group-hover/verify:translate-x-0.5"
        aria-hidden
      />
    </a>
  );
}

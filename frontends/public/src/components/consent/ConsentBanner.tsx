"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LuCookie, LuSettings2, LuX } from "react-icons/lu";
import { Link } from "@/i18n/navigation";
import { OPEN_CONSENT_SETTINGS, readConsent, saveConsent, type Consent } from "@/lib/consent";

const ALL: Consent = { analytics: true, preferences: true };
const NONE: Consent = { analytics: false, preferences: false };

/**
 * The cookie banner (first visit) and the settings panel (also opened from the footer).
 * Nothing optional is stored until the visitor chooses; see lib/consent.ts.
 */
export function ConsentBanner() {
  const t = useTranslations("consent");
  const [banner, setBanner] = useState(false);
  const [panel, setPanel] = useState(false);
  const [draft, setDraft] = useState<Consent>(NONE);
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);

  // The cookie is only readable in the browser: decide after the page has loaded.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the browser-only cookie once
    setBanner(readConsent() === null);
    const open = () => {
      setDraft(readConsent() ?? NONE);
      setPanel(true);
    };
    window.addEventListener(OPEN_CONSENT_SETTINGS, open);
    return () => window.removeEventListener(OPEN_CONSENT_SETTINGS, open);
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (panel && el && !el.open) el.showModal();
    if (!panel && el?.open) el.close();
  }, [panel]);

  const choose = (consent: Consent) => {
    saveConsent(consent);
    setBanner(false);
    setPanel(false);
  };

  const button =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const primary = `${button} bg-accent text-bg hover:brightness-110`;
  const secondary = `${button} border border-line bg-card text-fg hover:border-accent/50`;

  return (
    <>
      {banner && !panel && (
        <section
          role="region"
          aria-label={t("title")}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl motion-safe:animate-consent-float border border-line bg-card/95 p-4 shadow-2xl backdrop-blur sm:p-5"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <LuCookie className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-fg">{t("title")}</h2>
                <p className="mt-1 text-sm text-muted">
                  {t("text")}{" "}
                  <Link href="/cookies" className="text-accent underline underline-offset-2">
                    {t("policy")}
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:shrink-0 md:flex-nowrap">
              <button type="button" className={secondary} onClick={() => setPanel(true)}>
                <LuSettings2 className="size-4" aria-hidden />
                {t("customize")}
              </button>
              <button type="button" className={secondary} onClick={() => choose(NONE)}>
                {t("reject")}
              </button>
              <button type="button" className={primary} onClick={() => choose(ALL)}>
                {t("accept")}
              </button>
            </div>
          </div>
        </section>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="consent-settings-title"
        onClose={() => setPanel(false)}
        // A click on the dimmed area around the panel closes it, like the X (nothing is saved). Such clicks
        // land on the <dialog> itself, never on its content. The press must start there too, so selecting
        // text inside and letting go outside doesn't close it.
        onPointerDown={(e) => {
          pressedOutside.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (pressedOutside.current && e.target === e.currentTarget) setPanel(false);
        }}
        className="m-auto w-[min(34rem,calc(100%-1.5rem))] rounded-2xl border border-line bg-card p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <h2 id="consent-settings-title" className="font-display text-lg font-semibold">
              {t("settingsTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">{t("settingsText")}</p>
          </div>
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => setPanel(false)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-fg"
          >
            <LuX className="size-4" aria-hidden />
          </button>
        </div>

        <ul className="divide-y divide-line px-5">
          <Category title={t("necessary")} text={t("necessaryText")} checked disabled note={t("alwaysOn")} />
          <Category
            title={t("analytics")}
            text={t("analyticsText")}
            checked={draft.analytics}
            onChange={(analytics) => setDraft((d) => ({ ...d, analytics }))}
          />
          <Category
            title={t("preferences")}
            text={t("preferencesText")}
            checked={draft.preferences}
            onChange={(preferences) => setDraft((d) => ({ ...d, preferences }))}
          />
        </ul>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line p-5">
          <button type="button" className={secondary} onClick={() => choose(NONE)}>
            {t("rejectAll")}
          </button>
          <button type="button" className={secondary} onClick={() => choose(draft)}>
            {t("save")}
          </button>
          <button type="button" className={primary} onClick={() => choose(ALL)}>
            {t("acceptAll")}
          </button>
        </div>
      </dialog>
    </>
  );
}

function Category({
  title,
  text,
  checked,
  disabled = false,
  note,
  onChange,
}: {
  title: string;
  text: string;
  checked: boolean;
  disabled?: boolean;
  note?: string;
  onChange?: (value: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted">
          {text}
          {note ? ` ${note}.` : ""}
        </p>
      </div>
      <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center has-disabled:cursor-not-allowed">
        <input
          type="checkbox"
          role="switch"
          aria-label={title}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-accent peer-disabled:opacity-60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="pointer-events-none absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </label>
    </li>
  );
}

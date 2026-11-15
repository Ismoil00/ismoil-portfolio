"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LuQuote } from "react-icons/lu";

const linkClass =
  "not-italic text-sm text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:text-accent-soft hover:decoration-accent";

/**
 * The testimonial's words, shown as 2 lines so cards stay short and those without a quote
 * don't look empty next to them. When the text is longer, "… Read all" sits at the end of
 * the 2nd line; once opened, "Show less" follows the last word.
 *
 * How "Read all" lands on line 2: the paragraph is capped at 2 lines (max-height: 2lh) inside
 * a flex box (which makes that height usable for percentages). An empty float (::before) one
 * line shorter than the paragraph pushes the floated button down to the 2nd line, at the right;
 * the text wraps around it.
 */
export function ExpandableQuote({ text }: { text: string }) {
  const t = useTranslations("testimonials");
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    // Re-check on resize: a quote can fit on a wide screen and not on a narrow one.
    const observer = new ResizeObserver(() => setOverflows(el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  return (
    <figure className="mt-4">
      <blockquote className="relative flex pl-7">
        <LuQuote className="absolute left-0 top-0.5 size-4 text-accent/70" aria-hidden />
        <p
          ref={ref}
          className={`min-w-0 italic leading-relaxed text-muted ${
            open ? "" : "max-h-[2lh] overflow-hidden before:float-right before:h-[calc(100%-1lh)] before:content-['']"
          }`}
        >
          {!open && overflows && (
            <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="group/more float-right clear-both ml-1.5">
              <span aria-hidden className="not-italic text-muted">
                …{" "}
              </span>
              <span className={linkClass}>{t("readAll")}</span>
            </button>
          )}
          {text}
          {open && (
            <>
              {" "}
              <button type="button" onClick={() => setOpen(false)} aria-expanded className={`ml-1 ${linkClass}`}>
                {t("showLess")}
              </button>
            </>
          )}
        </p>
      </blockquote>
    </figure>
  );
}

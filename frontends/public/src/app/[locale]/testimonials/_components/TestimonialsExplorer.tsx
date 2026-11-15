"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { TestimonialFilterOptions, TestimonialsPage } from "@/types/content";
import { loadTestimonialsPage } from "@/api/testimonials.actions";
import { TestimonialCard } from "@/components/testimonials/TestimonialCard";
import { replaceUrlSearch, useUrlSearch } from "@/components/listing/url-state";
import { usePagedList } from "@/components/listing/usePagedList";
import { EmptyResults, ListError, LoadMoreButton, ResultBar } from "@/components/listing/ListingParts";
import {
  TestimonialsFilters,
  type Filters,
  emptyFilters,
  hasFilters,
  readFilters,
  toSearchParams,
} from "./TestimonialsFilters";
import { PAGE_SIZE } from "./constants";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * Paginated grid of testimonials with a date filter — works like the other list pages.
 * Opened with #testimonial-<id> (from an experience card), it keeps loading pages until that
 * testimonial is on screen, then scrolls to it and makes it glow briefly.
 */
export function TestimonialsExplorer({
  initial,
  options,
}: {
  initial: TestimonialsPage;
  options: TestimonialFilterOptions;
}) {
  const t = useTranslations("testimonialsPage");
  const locale = useLocale();
  const search = useUrlSearch();
  const filters = useMemo(() => readFilters(search), [search]);
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  const shown = useRef<string | null>(null);

  const list = usePagedList({
    search,
    initial,
    pageSize: PAGE_SIZE,
    load: (offset, limit) => loadTestimonialsPage(locale, { offset, limit, ...filters }),
  });

  const revealTarget = useEffectEvent(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id.startsWith("testimonial-") || shown.current === id) return;
    const el = document.getElementById(id);
    if (el) {
      shown.current = id;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.removeAttribute("data-flash");
      void el.offsetWidth; // restart the glow if it was already applied
      el.setAttribute("data-flash", "");
      setTimeout(() => el.removeAttribute("data-flash"), 2300);
    } else if (list.remaining > 0 && !list.loadingMore && !list.filtering) {
      void list.loadMore(); // not loaded yet — fetch the next 10 and look again
    }
  });
  useEffect(() => revealTarget(), [hash, list.items.length, list.loadingMore, list.filtering]);

  const setFilters = (next: Filters) => {
    list.clearError();
    replaceUrlSearch(toSearchParams(next));
  };
  const clear = () => setFilters(emptyFilters);

  return (
    <div>
      <TestimonialsFilters options={options} value={filters} onChange={setFilters} />
      <ResultBar
        filtering={list.filtering}
        shown={list.items.length}
        total={list.total}
        canClear={hasFilters(filters)}
        onClear={clear}
      />

      {list.items.length > 0 ? (
        <ul
          className={`grid gap-5 transition-opacity duration-200 md:grid-cols-2 lg:grid-cols-3 ${list.filtering ? "opacity-50" : ""}`}
        >
          {list.items.map((item, i) => (
            <li
              key={item.id}
              className="h-full animate-fade-up"
              style={{ animationDelay: `${(i % PAGE_SIZE) * 50}ms` }}
            >
              <TestimonialCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        !list.filtering && <EmptyResults text={t("empty")} onClear={clear} />
      )}

      {list.failed && <ListError>{t("error")}</ListError>}
      {list.remaining > 0 && !list.filtering && (
        <LoadMoreButton
          count={Math.min(PAGE_SIZE, list.remaining)}
          loading={list.loadingMore}
          onClick={list.loadMore}
        />
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CertificateFilterOptions, CertificatesPage } from "@/types/content";
import { loadCertificatesPage } from "@/api/certificates.actions";
import { CertificateCard } from "@/components/certificates/CertificateCard";
import { replaceUrlSearch, useUrlSearch } from "@/components/listing/url-state";
import { usePagedList } from "@/components/listing/usePagedList";
import { EmptyResults, ListError, LoadMoreButton, ResultBar } from "@/components/listing/ListingParts";
import {
  CertificatesFilters,
  type Filters,
  emptyFilters,
  hasFilters,
  readFilters,
  toSearchParams,
} from "./CertificatesFilters";
import { PAGE_SIZE } from "./constants";

/**
 * Filterable, paginated grid of certificates — works like the experience and projects pages:
 * first page rendered on the server, filters in the URL, "Show more" adds 10 at a time.
 */
export function CertificatesExplorer({
  initial,
  options,
}: {
  initial: CertificatesPage;
  options: CertificateFilterOptions;
}) {
  const t = useTranslations("certificatesPage");
  const locale = useLocale();
  const search = useUrlSearch();
  const filters = useMemo(() => readFilters(search), [search]);

  const list = usePagedList({
    search,
    initial,
    pageSize: PAGE_SIZE,
    load: (offset, limit) => loadCertificatesPage(locale, { offset, limit, ...filters }),
  });

  const setFilters = (next: Filters) => {
    list.clearError();
    replaceUrlSearch(toSearchParams(next));
  };
  const clear = () => setFilters(emptyFilters);

  return (
    <div>
      <CertificatesFilters options={options} value={filters} onChange={setFilters} />
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
              <CertificateCard item={item} />
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

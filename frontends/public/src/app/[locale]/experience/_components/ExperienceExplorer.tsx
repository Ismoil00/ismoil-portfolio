"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ExperienceFilterOptions, ExperiencePage } from "@/types/content";
import { loadExperiencePage } from "@/api/experience.actions";
import { ExperienceTimeline, TimelineItem } from "@/components/experience/ExperienceTimeline";
import { ExperienceCard } from "@/components/experience/ExperienceCard";
import { replaceUrlSearch, useUrlSearch } from "@/components/listing/url-state";
import { usePagedList } from "@/components/listing/usePagedList";
import { EmptyResults, ListError, LoadMoreButton, ResultBar } from "@/components/listing/ListingParts";
import { ExperienceFilters, type Filters, emptyFilters, hasFilters, readFilters, toSearchParams } from "./ExperienceFilters";
import { PAGE_SIZE } from "./constants";

/**
 * Filterable, paginated experience list.
 * The first page comes from the server (fast and crawlable); filter changes and "Show more"
 * go through a Server Action that uses the same api layer as the first render.
 */
export function ExperienceExplorer({ initial, options }: { initial: ExperiencePage; options: ExperienceFilterOptions }) {
  const t = useTranslations("experiencePage");
  const locale = useLocale();
  const search = useUrlSearch();
  const filters = useMemo(() => readFilters(search), [search]);

  const list = usePagedList({
    search,
    initial,
    pageSize: PAGE_SIZE,
    load: (offset, limit) => loadExperiencePage(locale, { offset, limit, ...filters }),
  });

  const setFilters = (next: Filters) => {
    list.clearError();
    replaceUrlSearch(toSearchParams(next));
  };
  const clear = () => setFilters(emptyFilters);

  return (
    <div>
      <ExperienceFilters options={options} value={filters} onChange={setFilters} />
      <ResultBar
        filtering={list.filtering}
        shown={list.items.length}
        total={list.total}
        canClear={hasFilters(filters)}
        onClear={clear}
      />

      {list.items.length > 0 ? (
        <div className={`transition-opacity duration-200 ${list.filtering ? "opacity-50" : ""}`}>
          <ExperienceTimeline reviveFirst>
            {list.items.map((job) => (
              <TimelineItem key={job.id} id={`experience-${job.id}`}>
                <ExperienceCard item={job} />
              </TimelineItem>
            ))}
          </ExperienceTimeline>
        </div>
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

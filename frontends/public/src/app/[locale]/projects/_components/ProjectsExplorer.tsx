"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ProjectFilterOptions, ProjectsPage } from "@/types/content";
import { loadProjectsPage } from "@/api/projects.actions";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { replaceUrlSearch, useUrlSearch } from "@/components/listing/url-state";
import { usePagedList } from "@/components/listing/usePagedList";
import { EmptyResults, ListError, LoadMoreButton, ResultBar } from "@/components/listing/ListingParts";
import { ProjectsFilters, type Filters, emptyFilters, hasFilters, readFilters, toSearchParams } from "./ProjectsFilters";
import { PAGE_SIZE } from "./constants";

/**
 * Filterable, paginated grid of project cards — works exactly like the experience page:
 * first page rendered on the server, filters in the URL, "Show more" adds 10 at a time.
 */
export function ProjectsExplorer({ initial, options }: { initial: ProjectsPage; options: ProjectFilterOptions }) {
  const t = useTranslations("projectsPage");
  const locale = useLocale();
  const search = useUrlSearch();
  const filters = useMemo(() => readFilters(search), [search]);

  const list = usePagedList({
    search,
    initial,
    pageSize: PAGE_SIZE,
    load: (offset, limit) => loadProjectsPage(locale, { offset, limit, ...filters }),
  });

  const setFilters = (next: Filters) => {
    list.clearError();
    replaceUrlSearch(toSearchParams(next));
  };
  const clear = () => setFilters(emptyFilters);

  return (
    <div>
      <ProjectsFilters options={options} value={filters} onChange={setFilters} />
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
          {list.items.map((project, i) => (
            <li
              key={project.id}
              className="h-full animate-fade-up"
              // Cards added by "Show more" appear one after another.
              style={{ animationDelay: `${(i % PAGE_SIZE) * 50}ms` }}
            >
              <ProjectCard project={project} index={i} />
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

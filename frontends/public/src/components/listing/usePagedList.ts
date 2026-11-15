"use client";

import { useEffect, useEffectEvent, useState } from "react";

export interface Page<T> {
  items: T[];
  total: number;
}

/**
 * Paging state for a filterable list whose first page was rendered on the server.
 * - When the filters (`search`, the URL query) change, the first page is fetched again
 *   (debounced, and stale responses are dropped).
 * - `loadMore` appends the next `pageSize` items to what's already shown.
 */
export function usePagedList<T extends { id: string }>({
  search,
  initial,
  pageSize,
  load,
}: {
  search: string;
  initial: Page<T>;
  pageSize: number;
  load: (offset: number, limit: number) => Promise<Page<T>>;
}) {
  const [loaded, setLoaded] = useState({ key: "", items: initial.items, total: initial.total });
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirstPage = useEffectEvent(() => load(0, pageSize));

  useEffect(() => {
    if (search === loaded.key) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const page = await loadFirstPage();
        if (!cancelled) setLoaded({ key: search, items: page.items, total: page.total });
      } catch {
        if (!cancelled) setFailedKey(search);
      }
    }, 200); // debounce rapid clicks in the filters
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, loaded.key]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await load(loaded.items.length, pageSize);
      setLoaded((prev) =>
        prev.key !== search
          ? prev // filters changed meanwhile — drop this response
          : {
              ...prev,
              total: page.total,
              items: [...prev.items, ...page.items.filter((n) => !prev.items.some((p) => p.id === n.id))],
            },
      );
      setFailedKey(null);
    } catch {
      setFailedKey(search);
    } finally {
      setLoadingMore(false);
    }
  };

  return {
    items: loaded.items,
    total: loaded.total,
    remaining: Math.max(0, loaded.total - loaded.items.length),
    /** New filters are being applied (the shown items are about to change). */
    filtering: search !== loaded.key && failedKey !== search,
    failed: failedKey === search,
    loadingMore,
    loadMore,
    clearError: () => setFailedKey(null),
  };
}

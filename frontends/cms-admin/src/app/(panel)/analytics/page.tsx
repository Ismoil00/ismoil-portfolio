import type { Metadata } from "next";
import Link from "next/link";
import { serverGet } from "@/api/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import type { Analytics, Count } from "@/types/api";
import { AssistantQuota } from "./AssistantQuota";

export const metadata: Metadata = { title: "Analytics" };

const PERIODS = [7, 30, 90, 365];

type Props = { searchParams: Promise<{ days?: string }> };

/** The public site's own visit statistics (no outside service): see backend services/analytics.py. */
export default async function AnalyticsPage({ searchParams }: Props) {
  const asked = Number((await searchParams).days);
  const days = PERIODS.includes(asked) ? asked : 30;
  const data = await serverGet<Analytics>("/admin/analytics", { days: String(days) });
  const { totals } = data;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Visits to the public site. Visitors are counted only for people who accepted analytics cookies."
        actions={
          <nav aria-label="Period" className="flex rounded-full border border-line p-1">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/analytics?days=${p}`}
                aria-current={p === days ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-sm ${p === days ? "bg-accent text-bg" : "text-subtle hover:text-fg"}`}
              >
                {p === 365 ? "1 year" : `${p} days`}
              </Link>
            ))}
          </nav>
        }
      />
      <div className="space-y-6">
        <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Page views" value={totals.page_views} />
          <Stat label="Visitors" value={totals.visitors} hint="with analytics consent" />
          <Stat label="Résumé downloads" value={totals.resume_downloads} />
          <Stat label="Contact messages" value={totals.messages} />
        </section>

        <Card title="Page views per day">
          <DailyChart daily={data.daily} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <TopList title="Pages" items={data.pages} />
          <TopList title="Came from" items={data.referrers} />
          <TopList title="Countries" items={data.countries} />
          <TopList title="Languages" items={data.locales} />
          <TopList title="Devices" items={data.devices} />
          <TopList
            title="Top questions"
            description="Asked to the AI assistant, only by visitors who allowed analytics. Kept 90 days; emails, phone numbers and links are hidden."
            items={data.questions}
            wrap
            className="lg:col-span-2"
          />
          {data.assistant && <AssistantQuota usage={data.assistant} />}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="text-sm text-subtle">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value.toLocaleString("en")}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function DailyChart({ daily }: { daily: Analytics["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.page_views));
  if (daily.every((d) => d.page_views === 0)) return <p className="text-sm text-subtle">No visits in this period yet.</p>;
  return (
    <div>
      <div className="flex h-48 items-end gap-px" role="img" aria-label="Page views per day">
        {daily.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.page_views} views, ${d.visitors} visitors`}
            className="min-w-0 flex-1 rounded-t bg-accent/70 transition-colors hover:bg-accent"
            style={{ height: `${Math.max(2, (d.page_views / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-subtle">
        <span>{daily[0]?.date}</span>
        <span>most in a day: {max}</span>
        <span>{daily.at(-1)?.date}</span>
      </div>
    </div>
  );
}

function TopList({
  title,
  items,
  description,
  wrap = false,
  className,
}: {
  title: string;
  items: Count[];
  description?: string;
  /** Long names (questions) wrap instead of being cut. */
  wrap?: boolean;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card title={title} description={description} className={className}>
      {items.length === 0 ? (
        <p className="text-sm text-subtle">Nothing yet.</p>
      ) : (
        <ul className="space-y-2" aria-label={title}>
          {items.map((item) => (
            <li key={item.name} className="relative overflow-hidden rounded-lg px-3 py-2 text-sm">
              <span className="absolute inset-y-0 left-0 bg-accent/15" style={{ width: `${(item.count / max) * 100}%` }} />
              <span className="relative flex justify-between gap-3">
                <span className={wrap ? "break-words" : "truncate"}>{item.name}</span>
                <span className="font-medium tabular-nums">{item.count}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

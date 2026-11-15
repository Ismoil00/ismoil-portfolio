import type { ReactNode } from "react";
import Link from "next/link";
import { LuPlus } from "react-icons/lu";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "./PageHeader";

/** A content list page: title, "Add" button, and either the rows or an empty state. */
export function ListPage({
  title,
  description,
  addHref,
  addLabel,
  emptyText,
  count,
  children,
}: {
  title: string;
  description: string;
  addHref: string;
  addLabel: string;
  emptyText: string;
  count: number;
  children: ReactNode;
}) {
  const add = (
    <Link href={addHref} className={buttonClass("primary", "md")}>
      <LuPlus className="size-4" /> {addLabel}
    </Link>
  );
  return (
    <>
      <PageHeader title={title} description={description} actions={add} />
      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-subtle">{emptyText}</p>
          <div className="mt-5 flex justify-center">{add}</div>
        </div>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </>
  );
}

/** One row of a content list, linking to its editor. */
export function ListRow({
  href,
  media,
  title,
  subtitle,
  meta,
  badges,
}: {
  href: string;
  media?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 rounded-2xl border border-line bg-card p-4 transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-card-hover"
      >
        {media}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold transition-colors group-hover:text-accent">{title}</p>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
          {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
        </div>
        {meta && <div className="hidden shrink-0 text-right text-sm text-subtle sm:block">{meta}</div>}
      </Link>
    </li>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "success" | "warning" }) {
  const tones = {
    default: "border-line text-subtle",
    accent: "border-accent/40 bg-accent/10 text-accent",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tones[tone]}`}>{children}</span>;
}

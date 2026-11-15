import { Container } from "./Container";

/** Placeholder shown by <Suspense> while a section's data is streaming in. */
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="py-20 sm:py-28" aria-hidden>
      <Container>
        <div className="mb-4 h-4 w-28 animate-pulse rounded bg-card-hover" />
        <div className="mb-12 h-10 w-2/3 max-w-md animate-pulse rounded bg-card-hover" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-line bg-card" />
          ))}
        </div>
      </Container>
    </div>
  );
}

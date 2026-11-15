import type { ReactNode } from "react";
import { Container } from "./Container";
import { Reveal } from "./Reveal";

interface SectionProps {
  id: string;
  eyebrow: string;
  title: string;
  /** Optional line right under the title (e.g. the question in Contact). */
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Shared wrapper: anchor id, eyebrow label, heading, and reveal-on-scroll. */
export function Section({ id, eyebrow, title, lead, children, className = "" }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`relative py-20 sm:py-28 ${className}`}>
      <Container>
        <Reveal>
          <p className="mb-3 flex items-center gap-3 font-display text-sm uppercase tracking-[0.25em] text-accent">
            <span className="h-px w-8 bg-accent" aria-hidden />
            {eyebrow}
          </p>
          <h2
            id={`${id}-title`}
            className={`${lead ? "mb-4" : "mb-12"} max-w-3xl font-display text-3xl font-semibold leading-tight text-fg sm:text-4xl lg:text-5xl`}
          >
            {title}
          </h2>
          {lead && <p className="mb-12 max-w-3xl text-xl leading-relaxed text-muted sm:text-[1.375rem]">{lead}</p>}
        </Reveal>
        {children}
      </Container>
    </section>
  );
}

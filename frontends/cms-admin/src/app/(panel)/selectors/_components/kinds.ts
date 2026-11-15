import type { SelectorKind, Usage } from "@/types/api";

export interface KindInfo {
  kind: SelectorKind;
  label: string; // tab
  singular: string; // "Add development field"
  description: string;
}

/** The selector lists, in the order of the tabs. */
export const kinds: KindInfo[] = [
  {
    kind: "development-fields",
    label: "Development fields",
    singular: "development field",
    description: "Directions of IT (Backend, AI & LLM, Civil engineering…). Filters on the Experience and Certificates pages, and Tech stack filters when activated there.",
  },
  {
    kind: "instruments",
    label: "Instruments",
    singular: "instrument",
    description: "Kinds of tools (Languages & frameworks, APIs & protocols, Tools…). Tech stack filters when activated there.",
  },
  {
    kind: "tech-stacks",
    label: "Tech stacks",
    singular: "technology",
    description: "Every technology. Pick the ones the site shows on the Tech stack page; experience and projects pick from all of them.",
  },
  { kind: "positions", label: "Positions", singular: "position", description: "Positions you held. \"My position\" on testimonials." },
  { kind: "companies", label: "Companies", singular: "company", description: "Employers and clients: experience, projects and testimonials." },
  { kind: "institutes", label: "Institutes", singular: "institute", description: "Universities, schools and course platforms: certificates." },
  { kind: "product-types", label: "Product types", singular: "product type", description: "What a project is: Web, Mobile, Game…" },
  {
    kind: "link-platforms",
    label: "Link platforms",
    singular: "link platform",
    description: "Icon and name of each \"Other link\" on the Contacts page (GitHub, LeetCode, a special project…).",
  },
];

export const kindInfo = (kind: SelectorKind) => kinds.find((k) => k.kind === kind)!;

const USAGE_WORDS: Record<keyof Usage, [string, string]> = {
  tech_stacks: ["technology", "technologies"],
  experiences: ["experience", "experiences"],
  projects: ["project", "projects"],
  testimonials: ["testimonial", "testimonials"],
  certificates: ["certificate", "certificates"],
  other_links: ["other link", "other links"],
  tech_section: ["Tech stack page", "Tech stack page"],
};

/** "2 projects · 1 experience" */
export function describeUsage(usage: Usage): string {
  return (Object.entries(usage) as [keyof Usage, number][])
    .map(([key, n]) => (key === "tech_section" ? "shown on the Tech stack page" : `${n} ${USAGE_WORDS[key][n === 1 ? 0 : 1]}`))
    .join(" · ");
}

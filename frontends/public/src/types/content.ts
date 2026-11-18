// Shapes of the data the public site renders: exactly what the backend's /public/* endpoints return
// (backend/app/schemas/public.py), one language per request. Optional things are null — hide them.

/** An SVG icon stored by the admin panel, drawn with a CSS mask (see components/ui/SvgIcon.tsx). */
export type SvgMarkup = string;

/** Job-search status shown in the hero badge: seeking (green) · open (yellow) · unavailable (red). */
export type AvailabilityStatus = "seeking" | "open" | "unavailable";

/** A direct way to message me (Contact section, footer, side rail). */
export interface ContactChannel {
  id: "email" | "telegram" | "whatsapp" | "linkedin";
  label: string;
  url: string;
  /** Shown under the label: the address, number or profile name. */
  handle: string;
}

/** Any other page of mine (Contact → "Other links"). */
export interface OtherLink {
  id: string;
  label: string;
  url: string;
  /** Platform icon; null → a generic globe. */
  icon: SvgMarkup | null;
  /** Brand color; null → the site's accent. */
  color: string | null;
}

export interface AboutBlock {
  title: string;
  /** The first one is the lead; `**text**` is emphasized. */
  paragraphs: string[];
  city: string;
  /** ISO 3166-1 alpha-2 — the country name is shown in the page's language (Intl.DisplayNames). */
  countryCode: string;
  /** "GMT+5" */
  utcOffset: string;
  openToRemote: boolean;
  openToRelocation: boolean;
}

/** Numbers counted from the content by the backend. */
export interface ProfileStats {
  experienceMonths: number;
  roles: number;
  projects: number;
  certificates: number;
  technologies: number;
}

export interface Profile {
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  tagline: string | null;
  availability: AvailabilityStatus;
  resumeUrl: string;
  about: AboutBlock;
  email: string | null;
  contacts: ContactChannel[];
  otherLinks: OtherLink[];
  stats: ProfileStats;
}

/** A labelled reference (filters, cross-links). */
export interface Ref {
  id: string;
  title: string;
}

/** A reference with an icon (tech-stack filters, product types). */
export interface IconRef extends Ref {
  icon: SvgMarkup | null;
}

/** A technology as shown on cards and chips. */
export interface TechRef {
  id: string;
  name: string;
  icon: SvgMarkup;
  /** Brand color. */
  color: string;
}

/** One tile in the tech-stack section. */
export interface TechItem extends TechRef {
  /** Official documentation, opened on click. */
  url: string | null;
  /** Ids of the categories (filters) it belongs to. */
  categories: string[];
}

export interface Skills {
  categories: IconRef[];
  items: TechItem[];
}

/** A company or institute. */
export interface Organization {
  name: string;
  url: string | null;
  logo: string | null;
}

/** An image or a video (project gallery, testimonial thumbnail, certificate scan). */
export interface MediaItem {
  type: "image" | "video";
  src: string;
  /** Still frame shown before a video plays. */
  poster: string | null;
  /** Intrinsic size in px — lets galleries reserve the right space before the file loads. */
  width: number | null;
  height: number | null;
  /** Set by the site where it knows a good description (e.g. the project's title). */
  alt?: string;
}

// --- experience ---------------------------------------------------------------------------------

export interface Experience {
  id: string;
  role: string;
  company: Organization;
  /** "YYYY-MM" */
  start: string;
  /** "YYYY-MM", or null while it's the current job. */
  end: string | null;
  /** Sanitized HTML from the admin panel's rich-text editor. */
  description: string;
  stack: TechRef[];
  /** id = the project's slug. */
  projects: Ref[];
  testimonials: Ref[];
}

/** Paging + filters for the experience list. Filters are OR within a group, AND across groups. */
export interface ExperienceQuery {
  offset: number;
  limit: number;
  companies?: string[];
  stack?: string[];
  fields?: string[];
  /** "YYYY-MM" — keep jobs that overlap this range. */
  from?: string;
  to?: string;
}

export interface ExperiencePage {
  items: Experience[];
  total: number;
}

export interface ExperienceFilterOptions {
  companies: string[];
  stack: TechRef[];
  fields: Ref[];
  minDate: string | null;
  maxDate: string | null;
}

// --- testimonials -------------------------------------------------------------------------------

export interface Testimonial {
  id: string;
  author: string;
  role: string;
  company: Organization;
  /** My role there: a development field or a technology, e.g. "Frontend development". */
  myRole: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Rich text: sanitized HTML from the admin's editor; null when there is no quote. */
  quote: string | null;
  media: MediaItem | null;
  /** My projects it's about (internal links). */
  projects: { title: string; href: string }[];
  verifyUrl: string;
}

export interface TestimonialQuery {
  offset: number;
  limit: number;
  from?: string;
  to?: string;
}

export interface TestimonialsPage {
  items: Testimonial[];
  total: number;
}

export interface TestimonialFilterOptions {
  minDate: string | null;
  maxDate: string | null;
}

// --- projects -----------------------------------------------------------------------------------

/** Monthly users of a live project, as a range (labels in messages `traffic.*`). */
export type TrafficRange = "under100" | "from100" | "from1k" | "from10k" | "from100k" | "over1m";

/** Traffic ranges from smallest to largest (also the steps of the traffic meter). */
export const trafficRanges: TrafficRange[] = ["under100", "from100", "from1k", "from10k", "from100k", "over1m"];

/** What a project card needs (home page + projects page). */
export interface ProjectSummary {
  /** The slug (URL of the project page). */
  id: string;
  title: string;
  types: IconRef[];
  /** "YYYY-MM" — the card shows its year as the release year. */
  end: string;
  /** The first 3 technologies only. */
  stack: TechRef[];
  cover: MediaItem | null;
  repoUrl: string | null;
  liveUrl: string | null;
  /** Under NDA: no links, no media. */
  isPrivate: boolean;
}

/** Who a project was built for. */
export interface ProjectClient {
  kind: "self" | "private" | "company";
  name: string | null;
  url: string | null;
}

/** Everything the project page shows. */
export interface Project extends Omit<ProjectSummary, "stack"> {
  /** One or two sentences: search engines and link previews. */
  summary: string;
  /** Rich text: sanitized HTML from the admin's editor (paragraphs, lists, bold, links…). */
  description: string;
  /** "YYYY-MM" */
  start: string;
  client: ProjectClient;
  /** Null when not set — the row is hidden. */
  traffic: TrafficRange | null;
  stack: TechRef[];
  media: MediaItem[];
}

export interface ProjectQuery {
  offset: number;
  limit: number;
  /** Company names, or `PRIVATE_CLIENTS` / `SELF_INITIATED`. */
  clients?: string[];
  stack?: string[];
  types?: string[];
  from?: string;
  to?: string;
}

export interface ProjectsPage {
  items: ProjectSummary[];
  total: number;
}

export interface ProjectFilterOptions {
  clients: string[];
  stack: TechRef[];
  types: IconRef[];
  minDate: string | null;
  maxDate: string | null;
}

/** Client filter value for projects built for an anonymous client. */
export const PRIVATE_CLIENTS = "private";
/** Client filter value for self-initiated projects (no client). */
export const SELF_INITIATED = "self";

// --- certificates -------------------------------------------------------------------------------

export interface Certificate {
  id: string;
  title: string;
  issuer: Organization;
  /** "YYYY-MM" */
  start: string;
  end: string;
  /** Fields of study (the filter on the certificates page). */
  fields: Ref[];
  /** Photos or scans; the first is the thumbnail. Empty → a placeholder. */
  images: MediaItem[];
  /** The issuer's page where anyone can check it; null → no button. */
  verifyUrl: string | null;
}

export interface CertificateQuery {
  offset: number;
  limit: number;
  fields?: string[];
  from?: string;
  to?: string;
}

export interface CertificatesPage {
  items: Certificate[];
  total: number;
}

export interface CertificateFilterOptions {
  fields: Ref[];
  minDate: string | null;
  maxDate: string | null;
}

export interface ContactPayload {
  name: string;
  /** How to reply: an email address or a WhatsApp number. */
  contact: string;
  message: string;
  /** Hidden field: people leave it empty, form-filling bots don't. */
  website?: string;
}

// Shapes the backend returns to the admin panel (see backend/app/schemas).
import type { I18nText } from "@/lib/i18n";

export interface Media {
  id: string;
  purpose: string;
  url: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  original_name: string;
  poster_url: string | null;
}

/** What uses a selector item, e.g. { projects: 2 }; items in use can't be deleted. */
export type Usage = Partial<
  Record<"tech_stacks" | "experiences" | "projects" | "testimonials" | "certificates" | "other_links" | "tech_section", number>
>;

interface SelectorBase {
  id: string;
  position: number;
  usage: Usage;
}

export interface DevelopmentField extends SelectorBase {
  name: I18nText;
  icon_svg: string | null;
}
export type Instrument = DevelopmentField;

export interface TechStack extends SelectorBase {
  name: string;
  icon_svg: string;
  color: string;
  docs_url: string | null;
  field_ids: string[];
  instrument_ids: string[];
}

export interface Company extends SelectorBase {
  name: string;
  website_url: string | null;
  logo: Media | null;
}

export interface Institute extends SelectorBase {
  name: I18nText;
  website_url: string | null;
  logo: Media | null;
}

export interface ProductType extends SelectorBase {
  name: I18nText;
  icon_svg: string;
}

export interface LinkPlatform extends SelectorBase {
  name: string;
  icon_svg: string | null;
  color: string | null;
}

export interface SelectorItems {
  "development-fields": DevelopmentField;
  instruments: Instrument;
  "tech-stacks": TechStack;
  companies: Company;
  institutes: Institute;
  "product-types": ProductType;
  "link-platforms": LinkPlatform;
}
export type SelectorKind = keyof SelectorItems;
export type AnySelectorItem = SelectorItems[SelectorKind];

export type Availability = "seeking" | "open" | "unavailable";

export interface Hero {
  first_name: I18nText;
  last_name: I18nText;
  role: I18nText;
  description: I18nText | null;
  resume: Media;
  availability: Availability;
  updated_at: string;
}

export interface About {
  title: I18nText;
  paragraph_1: I18nText;
  paragraph_2: I18nText | null;
  city: I18nText;
  country_code: string;
  timezone: string;
  utc_offset: string;
  open_to_remote: boolean;
  open_to_relocation: boolean;
  updated_at: string;
}

export type ContactChannel = "email" | "telegram" | "whatsapp" | "linkedin";

export interface Contacts {
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  links: Record<ContactChannel, { url: string; handle: string } | null>;
  updated_at: string;
}

export interface OtherLink {
  id: string;
  platform: { id: string; name: string; icon_svg: string | null; color: string | null };
  url: string;
  position: number;
}

export interface TechShowcase {
  filters: { kind: "field" | "instrument"; id: string }[];
  tech_ids: string[];
}

export interface ContactMessage {
  id: string;
  name: string;
  contact: string;
  message: string;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface CompanyRef {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
}

export interface Experience {
  id: string;
  title: I18nText;
  company: CompanyRef;
  start: string;
  end: string | null;
  is_current: boolean;
  description: I18nText;
  tech_ids: string[];
  field_ids: string[];
  project_ids: string[];
  testimonial_ids: string[];
  updated_at: string;
}

export type ClientKind = "self" | "private" | "company";
export type Traffic = "under100" | "from100" | "from1k" | "from10k" | "from100k" | "over1m";

export interface Project {
  id: string;
  slug: string;
  title: I18nText;
  description: I18nText;
  start: string;
  end: string;
  client_kind: ClientKind;
  company: CompanyRef | null;
  /** Empty only on projects loaded from the old site; the editor asks for it. */
  traffic: Traffic | null;
  live_url: string | null;
  repo_url: string | null;
  is_private: boolean;
  type_ids: string[];
  tech_ids: string[];
  media: Media[];
  cover_id: string | null;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  author_name: I18nText;
  author_role: I18nText;
  company: CompanyRef;
  /** My role: a development field or a technology, exactly one. */
  field: { id: string; name: I18nText } | null;
  tech_stack: { id: string; name: string } | null;
  /** How it reads on the site: "Frontend development", per language. */
  role: I18nText;
  given_on: string;
  quote: I18nText | null;
  media: Media | null;
  verify_url: string;
  project_ids: string[];
  updated_at: string;
}

export interface Certificate {
  id: string;
  title: I18nText;
  institute: { id: string; name: I18nText; website_url: string | null; logo_url: string | null };
  start: string;
  end: string;
  /** Empty only on certificates loaded from the old site; the editor asks for it. */
  verify_url: string | null;
  field_ids: string[];
  images: Media[];
  updated_at: string;
}

/** What helps fill Russian and Tajik from English (Settings page). */
export type Translator = "claude" | "google_web" | "manual";

export interface PanelSettings {
  translator: Translator;
  /** ANTHROPIC_API_KEY is set on the backend, so Claude can be chosen. */
  claude_ready: boolean;
}

/** The signed-in admin (GET /auth/me). */
export type Me = { username: string };

/** Visit statistics for the Analytics page (GET /admin/analytics?days=…). */
export type Count = { name: string; count: number };
export type Analytics = {
  days: number;
  totals: { page_views: number; visitors: number; resume_downloads: number; messages: number };
  daily: { date: string; page_views: number; visitors: number }[];
  pages: Count[];
  referrers: Count[];
  countries: Count[];
  locales: Count[];
  devices: Count[];
};

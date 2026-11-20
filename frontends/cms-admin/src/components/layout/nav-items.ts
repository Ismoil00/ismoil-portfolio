import type { IconType } from "react-icons";
import {
  LuAward,
  LuBriefcaseBusiness,
  LuChartColumn,
  LuContact,
  LuFolderKanban,
  LuLayers,
  LuListTree,
  LuQuote,
  LuSparkles,
  LuUserRound,
} from "react-icons/lu";

export interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  /** One line under the page title. */
  description: string;
}

/** The left menu, in the order of the public site's sections (Selectors last: it feeds the others). */
export const navItems: NavItem[] = [
  { href: "/hero", label: "Hero", icon: LuSparkles, description: "Name, title, résumé and job-search status." },
  { href: "/about", label: "About me", icon: LuUserRound, description: "Title, paragraphs, location and work format." },
  { href: "/tech-stack", label: "Tech stack", icon: LuLayers, description: "Which filters and technologies the site shows." },
  { href: "/experience", label: "Experience", icon: LuBriefcaseBusiness, description: "Jobs, from the newest." },
  { href: "/projects", label: "Projects", icon: LuFolderKanban, description: "Everything you've built, with galleries." },
  { href: "/testimonials", label: "Testimonials", icon: LuQuote, description: "What people say about working with you." },
  { href: "/certificates", label: "Certificates", icon: LuAward, description: "Certificates and diplomas." },
  { href: "/contacts", label: "Contacts", icon: LuContact, description: "Ways to reach you, other links and messages." },
  { href: "/selectors", label: "Selectors", icon: LuListTree, description: "The lists the other pages pick from." },
  { href: "/analytics", label: "Analytics", icon: LuChartColumn, description: "Visits to the public site." },
];

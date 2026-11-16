// Every backend route the public site calls, in one place.
export const endpoints = {
  profile: "/public/profile",
  skills: "/public/skills",
  experience: "/public/experience",
  experienceFilters: "/public/experience/filters",
  testimonials: "/public/testimonials",
  testimonialFilters: "/public/testimonials/filters",
  projects: "/public/projects",
  projectFilters: "/public/projects/filters",
  projectSlugs: "/public/projects/slugs",
  project: (slug: string) => `/public/projects/${encodeURIComponent(slug)}`,
  certificates: "/public/certificates",
  certificateFilters: "/public/certificates/filters",
  contact: "/public/contact",
} as const;

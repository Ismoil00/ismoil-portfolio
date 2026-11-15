// Section anchors on the home page, in display order. Labels come from messages `nav.*`.
export const navItems = ["about", "skills", "experience", "projects", "testimonials", "certificates", "contact"] as const;
export type NavItem = (typeof navItems)[number];

/** The menu for the current data: "Testimonials" only while that section is shown (≥ 1 testimonial). */
export function visibleNavItems({ hasTestimonials }: { hasTestimonials: boolean }): NavItem[] {
  return navItems.filter((item) => item !== "testimonials" || hasTestimonials);
}

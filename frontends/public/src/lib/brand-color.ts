/**
 * Brand colors are stored for the dark design: brands whose logo is black are saved as white,
 * and concepts without a brand use the dark theme's accent. On the light theme those would
 * vanish, so they are swapped for theme-aware colors; every real brand color passes through.
 */
export function themedBrandColor(color: string): string {
  switch (color.trim().toLowerCase()) {
    case "#fff":
    case "#ffffff":
      return "var(--color-fg)";
    case "#a4c4ff":
      return "var(--color-accent)";
    default:
      return color;
  }
}

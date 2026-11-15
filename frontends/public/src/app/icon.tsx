import { renderBrandIcon } from "@/lib/brand-icon";

// Browser-tab favicon, generated once at build time from the "IS." logo.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return renderBrandIcon(size.width, true);
}

import { renderBrandIcon } from "@/lib/brand-icon";

// Home-screen icon for iPhone/iPad (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderBrandIcon(size.width, false);
}

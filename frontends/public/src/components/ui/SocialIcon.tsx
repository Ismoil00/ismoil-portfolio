import { SiTelegram, SiWhatsapp } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa6";
import { LuMail } from "react-icons/lu";
import type { ContactChannel } from "@/types/content";

type ChannelId = ContactChannel["id"];

const icons = {
  linkedin: FaLinkedinIn,
  telegram: SiTelegram,
  whatsapp: SiWhatsapp,
  email: LuMail,
} satisfies Record<ChannelId, unknown>;

/**
 * The platforms' own brand colors (simpleicons.org). Black logos use the text color: white on
 * the dark theme, near-black on the light one. Email has no brand (any mail app opens), so it
 * keeps the inherited color.
 */
const brandColors: Partial<Record<ChannelId, string>> = {
  linkedin: "#0A66C2",
  telegram: "#26A5E4",
  whatsapp: "#25D366",
};

/** `brand`: show the platform's own color (Contact tiles) instead of the inherited one (hero rail, footer). */
export function SocialIcon({
  id,
  className = "size-5",
  brand = false,
}: {
  id: ChannelId;
  className?: string;
  brand?: boolean;
}) {
  const Icon = icons[id];
  const color = brand ? brandColors[id] : undefined;
  return <Icon className={className} style={color ? { color } : undefined} aria-hidden />;
}

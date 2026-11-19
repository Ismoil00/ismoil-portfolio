import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk, Tajawal } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BackgroundGlow } from "@/components/layout/BackgroundGlow";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// The public site's fonts; Manrope covers Cyrillic (Russian and Tajik texts in the forms).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const tajawal = Tajawal({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-tajawal", display: "swap" });
const manrope = Manrope({
  subsets: ["cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#080a0f", colorScheme: "dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${tajawal.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-svh">
        <BackgroundGlow />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}

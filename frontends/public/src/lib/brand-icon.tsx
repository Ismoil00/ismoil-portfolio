import { ImageResponse } from "next/og";

/** Loads Space Grotesk Bold (only the glyphs "IS.") so the icon matches the header logo. */
async function loadLogoFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&text=IS.")
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null; // offline build: falls back to the built-in sans font
  }
}

/** Renders the "IS." logo as a PNG (used for the favicon and the Apple touch icon). */
export async function renderBrandIcon(px: number, rounded: boolean) {
  const font = await loadLogoFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080a0f",
          borderRadius: rounded ? px * 0.22 : 0,
          color: "#e5e9f0",
          fontFamily: font ? "Space Grotesk" : undefined,
          fontWeight: 700,
          fontSize: px * 0.52,
          letterSpacing: -px * 0.02,
          paddingBottom: px * 0.04,
        }}
      >
        IS<span style={{ color: "#a4c4ff" }}>.</span>
      </div>
    ),
    {
      width: px,
      height: px,
      fonts: font ? [{ name: "Space Grotesk", data: font, weight: 700, style: "normal" }] : undefined,
    },
  );
}

import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon: the "IS." mark on the site's dark background, so admin tabs are easy to spot. */
export default function Icon() {
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
          borderRadius: 14,
          color: "#e5e9f0",
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        IS<span style={{ color: "#a4c4ff" }}>.</span>
      </div>
    ),
    size,
  );
}

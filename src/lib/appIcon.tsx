// Shared mark for every generated app icon (favicon, apple-icon, manifest
// icons): the WhereNext compass in cream on a forest-green rounded square
// (Phase 24). No external image assets or dependencies needed -- next/og
// renders this to a real PNG at build time.
import { ImageResponse } from "next/og";

export function renderIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  // maskable icons need the mark inside a safe zone (~80%) since platforms
  // may crop a circle/rounded-square out of the full square, so they get a
  // full-bleed background and a smaller mark
  const radius = maskable ? 0 : size * 0.22;
  const mark = size * (maskable ? 0.5 : 0.7);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2e4a3b",
          borderRadius: radius,
        }}
      >
        <svg
          width={mark}
          height={mark}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f6f3ec"
          strokeWidth={size <= 48 ? 2.4 : 1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z" fill="#f6f3ec" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}

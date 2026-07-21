// Shared mark for every generated app icon (apple-icon, manifest icons):
// a rounded emerald-on-dark square with the app's initials, matching the
// site's existing dark theme + emerald accent. No external image assets or
// dependencies needed -- next/og renders this to a real PNG at build time.
import { ImageResponse } from "next/og";

export function renderIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  // maskable icons need the mark to sit inside a safe zone (~80%) since
  // platforms may crop a circle/rounded-square out of the full square
  const pad = maskable ? size * 0.22 : size * 0.14;
  const radius = maskable ? 0 : size * 0.22;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          borderRadius: radius,
        }}
      >
        <div
          style={{
            width: size - pad * 2,
            height: size - pad * 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: (size - pad * 2) * 0.22,
            background: "#10b981",
            color: "#09090b",
            fontSize: (size - pad * 2) * 0.46,
            fontWeight: 800,
            fontFamily: "sans-serif",
          }}
        >
          TP
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}

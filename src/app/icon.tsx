import { renderIcon } from "@/lib/appIcon";

// Modern favicon, generated the same way as apple-icon.tsx -- Next.js wires
// this up as the browser-tab icon automatically (takes precedence over the
// static favicon.ico for browsers that support it).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return renderIcon(32);
}

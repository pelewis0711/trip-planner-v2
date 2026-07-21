import { renderIcon } from "@/lib/appIcon";

// iOS reads this for the home-screen icon when "Added to Home Screen" --
// it does NOT use the web manifest's icons array (that's for Android/desktop).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderIcon(180);
}

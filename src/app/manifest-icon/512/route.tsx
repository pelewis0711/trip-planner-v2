import { renderIcon } from "@/lib/appIcon";

export const dynamic = "force-static";

export function GET() {
  return renderIcon(512);
}

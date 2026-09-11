"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import InstallPrompt from "@/components/InstallPrompt";
import FoodFixNotice from "@/components/FoodFixNotice";
import { useAuthStore } from "@/lib/store/auth";
import { isPublicPath } from "@/lib/auth/gate";

// Which chrome a page gets above its content.
//
// The full app chrome -- Header with its tabs and Home/Plan pickers, the
// install and food-fix banners -- is for signed-in users. Since the sign-in
// gate (src/proxy.ts), a signed-out visitor only ever reaches the public pages,
// and there that chrome is a dead end (every tab bounces to /welcome), so they
// get just the logo and a way to sign in. /welcome brings its own layout.
//
// Gated pages always get the full chrome: the server already guaranteed a
// user, so there's no reason to wait for the browser's auth check (and no way
// for a signed-in user who's merely offline to lose it).
//
// LocalSetupBanner, the anonymous setup wizard's entry point, is deliberately
// no longer mounted: its only audience was signed-out visitors. The file is
// kept -- see CLAUDE.md, "Who can use the app".
export default function AppChrome() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  if (pathname === "/welcome") return null;
  if (isPublicPath(pathname) && !user) return <SlimHeader pathname={pathname} />;

  return (
    <>
      <Header />
      <InstallPrompt />
      <FoodFixNotice />
    </>
  );
}

function SlimHeader({ pathname }: { pathname: string }) {
  // From a share link, come back to that same plan after signing in.
  const signInHref = pathname.startsWith("/shared/")
    ? `/login?${new URLSearchParams({ next: pathname })}`
    : "/login";

  return (
    <header className="border-b border-border bg-surface/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/welcome" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-white">
            S
          </span>
          <span className="font-heading text-lg leading-none font-bold text-ink">Semesterly</span>
        </Link>
        {pathname !== "/login" && (
          <Link href={signInHref} className="btn btn-primary btn-sm shrink-0">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

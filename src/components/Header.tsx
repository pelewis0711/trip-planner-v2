"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHomeStore } from "@/lib/store/home";
import { HOMES } from "@/data/homes";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/catalog", label: "Trip Catalog" },
  { href: "/calendar", label: "My Calendar" },
  { href: "/itinerary", label: "Itinerary & Totals" },
  { href: "/plans", label: "Plans & Compare" },
];

export default function Header() {
  const pathname = usePathname();
  const home = useHomeStore((s) => s.home);
  const setHome = useHomeStore((s) => s.setHome);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div>
          <div className="text-base font-semibold text-zinc-50">Trip Planner v2</div>
          <div className="text-[11px] font-medium tracking-wide text-zinc-500">
            SPRING 2027 &middot; PER PERSON USD
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-400">
          <span aria-hidden>🏠</span>
          <span className="hidden sm:inline">Home</span>
          <select
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm font-semibold text-zinc-100"
          >
            {Object.keys(HOMES).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>

        <nav className="ml-0 flex flex-1 flex-wrap gap-1.5 sm:ml-auto">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-500 text-zinc-950"
                    : "border border-zinc-800 text-zinc-400 hover:border-emerald-500/50 hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

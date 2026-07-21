"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActivePlan, usePlanStore } from "@/lib/store/plan";
import { HOMES } from "@/data/homes";
import { makeCtx } from "@/lib/calc/context";
import { grandTotals } from "@/lib/calc/costs";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/catalog", label: "Trip Catalog" },
  { href: "/calendar", label: "My Calendar" },
  { href: "/itinerary", label: "Itinerary & Totals" },
  { href: "/plans", label: "Plans & Compare" },
];

export default function Header() {
  const pathname = usePathname();
  const { id, home, bag, placements } = useActivePlan();
  const setHome = usePlanStore((s) => s.setHome);
  const switchPlan = usePlanStore((s) => s.switchPlan);
  const plans = usePlanStore((s) => s.plans);
  const total = grandTotals(placements, makeCtx(home, bag)).total;

  const planIds = Object.keys(plans).sort((a, b) => plans[b].updated - plans[a].updated);
  const totalPill = (
    <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300">
      Total: <span className="text-emerald-400">${Math.round(total).toLocaleString()}</span>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start">
          <div>
            <div className="text-base font-semibold text-zinc-50">Trip Planner v2</div>
            <div className="text-[11px] font-medium tracking-wide text-zinc-500">
              SPRING 2027 &middot; PER PERSON USD
            </div>
          </div>
          <div className="sm:hidden">{totalPill}</div>
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

        <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-400">
          <span aria-hidden>📋</span>
          <span className="hidden sm:inline">Plan</span>
          <select
            value={id}
            onChange={(e) => switchPlan(e.target.value)}
            className="max-w-[140px] rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm font-semibold text-zinc-100"
          >
            {planIds.map((pid) => (
              <option key={pid} value={pid}>
                {plans[pid].name}
              </option>
            ))}
          </select>
        </label>

        <nav className="order-last flex w-full gap-1.5 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:flex-wrap sm:overflow-visible sm:ml-auto">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
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

        <div className="hidden sm:block">{totalPill}</div>
      </div>
    </header>
  );
}

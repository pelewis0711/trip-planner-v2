"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSharedPlan, joinPlanAsCollaborator } from "@/lib/supabase/sharing";
import { fetchProfileEmails } from "@/lib/supabase/profiles";
import { usePlanStore, type Plan } from "@/lib/store/plan";
import { useAuthStore } from "@/lib/store/auth";
import { planGrandTotals, planSlotSummary } from "@/lib/planTotals";
import { getSlotsForPlan } from "@/lib/calc/semester";
import { formatMoney } from "@/lib/calc/currency";

export default function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const currency = usePlanStore((s) => s.defaultCurrency);
  const money = (n: number) => formatMoney(n, currency);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">("loading");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    getSharedPlan(supabase, token).then(async (p) => {
      if (cancelled) return;
      if (!p) {
        setStatus("not-found");
        return;
      }
      setPlan(p);
      if (p.ownerId) {
        const emails = await fetchProfileEmails(supabase, [p.ownerId]);
        if (!cancelled) setOwnerEmail(emails.get(p.ownerId) ?? null);
      }
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") return <Centered>Loading shared plan…</Centered>;
  if (status === "not-found" || !plan) {
    return <Centered>This share link isn&apos;t valid anymore — ask for a fresh one.</Centered>;
  }

  const isCollabLink = plan.shareCollabToken === token;
  const g = planGrandTotals(plan);
  const slots = getSlotsForPlan(plan).filter((s) => plan.placements[s.id]?.stops.length);

  const handleJoin = async () => {
    if (authLoading) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/shared/${token}`)}`);
      return;
    }
    setJoining(true);
    const supabase = createClient();
    const joined = await joinPlanAsCollaborator(supabase, token);
    setJoining(false);
    if (!joined) {
      alert("Couldn't join this plan — try again in a moment.");
      return;
    }
    usePlanStore.getState().setUserId(user.id);
    usePlanStore.getState().mergeRemote([joined]);
    usePlanStore.getState().switchPlan(joined.id);
    router.push("/itinerary");
  };

  const handleAddToCompare = () => {
    usePlanStore.getState().addSharedPlan(plan);
    router.push("/plans");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="text-xs font-semibold tracking-wide text-emerald-400 uppercase">
          {isCollabLink ? "Shared to collaborate" : "Shared to view"}
        </div>
        <h2 className="mt-1 text-xl font-semibold text-zinc-50">{plan.name}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {ownerEmail ? `Shared by ${ownerEmail} · ` : ""}Home base: {plan.home}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Trips", String(g.count), "text-zinc-100"],
              ["Nights away", String(g.nights), "text-zinc-100"],
              ["Subtotal", money(g.total), "text-emerald-400"],
              ["Per night", g.nights ? money(g.total / g.nights) : "—", "text-zinc-100"],
            ] as const
          ).map(([label, val, cls]) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
              <b className={`block text-lg font-extrabold ${cls}`}>{val}</b>
              <span className="text-[11px] text-zinc-500">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isCollabLink && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining || authLoading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950 disabled:opacity-50"
            >
              {joining
                ? "Joining…"
                : authLoading
                  ? "Checking sign-in…"
                  : user
                    ? "Join to edit together"
                    : "Sign in to join & edit"}
            </button>
          )}
          <button
            type="button"
            onClick={handleAddToCompare}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500"
          >
            Add to my Compare (view only)
          </button>
        </div>
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold text-zinc-300">Schedule</h3>
      <div className="space-y-2">
        {slots.length ? (
          slots.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
              <div className="text-xs text-zinc-500">
                {s.label} · {s.date}
              </div>
              <div className="text-zinc-100">{planSlotSummary(plan, s.id)}</div>
            </div>
          ))
        ) : (
          <div className="text-sm text-zinc-500">No trips scheduled yet.</div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12 text-center text-sm text-zinc-400">
      {children}
    </div>
  );
}

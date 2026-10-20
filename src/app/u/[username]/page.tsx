"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { fetchProfileView, fetchSocialSettings } from "@/lib/supabase/social";
import {
  BUDGET_LEVELS,
  genderLabel,
  termLabel,
  type ProfileFieldKey,
  type ProfileView,
  type SocialSettingsRow,
} from "@/lib/social/profile";
import { interestLabel } from "@/data/interests";
import ProfileConnections from "@/components/social/ProfileConnections";
import Avatar from "@/components/social/Avatar";
import VerifiedBadge from "@/components/social/VerifiedBadge";
import { cardClass } from "@/components/social/controls";

// Phase 26: a profile as the viewer is allowed to see it (mockup screen 3).
// get_public_profile() already dropped every field this viewer can't see, so
// this page just renders what came back. On your own profile you can flip to
// "As a friend" to preview exactly what your privacy settings show.
// Friend / Message buttons arrive in Phases 27-28.

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ok"; view: ProfileView };

const FIELD_PROPS: Record<ProfileFieldKey, (keyof ProfileView)[]> = {
  photo: ["avatar_path"],
  bio: ["bio"],
  gender: ["gender", "gender_custom"],
  host_city: ["host_city", "host_country"],
  host_university: ["host_university"],
  program: ["program"],
  home_university: ["home_university"],
  grad_year: ["grad_year"],
  abroad_dates: ["abroad_start", "abroad_end"],
  languages: ["languages"],
  budget_level: ["budget_level"],
  travel_interests: ["travel_interests"],
  personal_interests: ["personal_interests"],
  custom_details: ["custom_details"],
};

/** Your own full view, trimmed to what a friend would get. */
function asFriend(view: ProfileView, settings: SocialSettingsRow): ProfileView {
  const out: ProfileView = {
    id: view.id,
    username: view.username,
    display_name: view.display_name,
    access: "friend",
    verified: view.verified,
  };
  for (const f of settings.visible_fields) {
    for (const k of FIELD_PROPS[f]) (out as unknown as Record<string, unknown>)[k] = view[k];
  }
  return out;
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username ?? "");
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [settings, setSettings] = useState<SocialSettingsRow | null>(null);
  const [relationshipVersion, setRelationshipVersion] = useState(0);
  const [preview, setPreview] = useState<"self" | "friend">("self");

  useEffect(() => {
    if (authLoading || !user) return;
    let live = true;
    (async () => {
      const supabase = createClient();
      const view = await fetchProfileView(supabase, username);
      if (!live) return;
      if (!view) {
        setState({ kind: "missing" });
        return;
      }
      setState({ kind: "ok", view });
      if (view.access === "self") setSettings(await fetchSocialSettings(supabase, user.id));
    })();
    return () => { live = false; };
  }, [authLoading, user, username, relationshipVersion]);

  const refreshRelationship = useCallback(() => setRelationshipVersion(v => v + 1), []);
  const markMissing = useCallback(() => setState({ kind: "missing" }), []);

  if (state.kind === "loading") {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-muted">Loading…</div>;
  }
  if (state.kind === "missing") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">Profile not available</h1>
        <p className="mt-2 text-sm text-muted">There&apos;s no one with that username, or their profile is private.</p>
      </div>
    );
  }

  const isSelf = state.view.access === "self";
  const v = isSelf && preview === "friend" && settings ? asFriend(state.view, settings) : state.view;

  const school = [v.home_university, v.program ?? v.host_university, termLabel(v.abroad_start)].filter(Boolean).join(" · ");
  const facts: [string, string][] = [];
  if (v.host_city) facts.push(["Host city", [v.host_city, v.host_country].filter(Boolean).join(", ")]);
  if (v.host_university) facts.push(["Host university", v.host_university]);
  if (v.program) facts.push(["Program", v.program]);
  if (v.home_university) facts.push(["Home university", v.home_university + (v.grad_year ? `, Class of ${v.grad_year}` : "")]);
  else if (v.grad_year) facts.push(["Graduation year", String(v.grad_year)]);
  if (v.languages?.length) facts.push(["Languages", v.languages.join(", ")]);
  if (v.budget_level) facts.push(["Budget", BUDGET_LEVELS.find((b) => b.value === v.budget_level)?.label ?? v.budget_level]);
  const gender = genderLabel(v);
  if (gender) facts.push(["Gender", gender]);
  for (const c of v.custom_details ?? []) facts.push([c.label, c.value]);

  const interests = [...(v.travel_interests ?? []), ...(v.personal_interests ?? [])];
  const nothingShared = !v.bio && !facts.length && !interests.length;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
      {isSelf && (
        <div role="group" aria-label="Preview" className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-1">
          {(["self", "friend"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preview === p}
              onClick={() => setPreview(p)}
              className={`min-h-10 rounded-lg text-[13px] font-bold ${preview === p ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
            >
              {p === "self" ? "As you" : "As a friend sees it"}
            </button>
          ))}
        </div>
      )}

      <section className="flex flex-col items-center gap-2 text-center">
        <Avatar path={v.avatar_path} name={v.display_name} size={92} />
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl font-bold">{v.display_name}</h1>
          {v.verified && <VerifiedBadge />}
        </div>
        <div className="text-sm text-muted">@{v.username}</div>
        {school && <div className="text-[13px] text-muted">{school}</div>}
      </section>

      {isSelf && preview === "self" && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Link href="/profile/edit" className="btn btn-primary btn-md">Edit profile</Link>
          <Link href="/settings/privacy" className="btn btn-secondary btn-md">Privacy</Link>
        </div>
      )}

      {!isSelf && <ProfileConnections key={state.view.id} id={state.view.id} onBlocked={markMissing} onRefresh={refreshRelationship} />}

      <div className="mt-4 flex flex-col gap-3.5">
        {v.bio && <p className="text-sm leading-relaxed">{v.bio}</p>}

        {interests.length > 0 && (
          <section className={`${cardClass} flex flex-col gap-2.5`}>
            <h2 className="text-sm font-bold">Interests</h2>
            <div className="flex flex-wrap gap-1.5">
              {interests.map((s) => (
                <span key={s} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{interestLabel(s)}</span>
              ))}
            </div>
          </section>
        )}

        {facts.length > 0 && (
          <section className="flex flex-col rounded-card border border-border bg-surface px-4 py-1.5">
            {facts.map(([k, val], i) => (
              <div key={`${k}-${i}`} className="flex min-h-11 items-center justify-between gap-4 border-b border-[#f0ece3] text-[13px] last:border-b-0">
                <span className="text-muted">{k}</span>
                <span className="text-right font-semibold">{val}</span>
              </div>
            ))}
          </section>
        )}

        {nothingShared && (
          <p className="rounded-xl bg-surface-muted px-4 py-3 text-center text-sm text-muted">
            {isSelf && preview === "friend"
              ? "Friends only see your name and username right now. Turn details on in Privacy."
              : isSelf
                ? "Add details from Edit profile."
                : "Nothing else shared yet."}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { fetchSocialSettings, saveSocialSettings } from "@/lib/supabase/social";
import {
  AUDIENCES,
  SETTINGS_SECTIONS,
  isToggleOn,
  setToggles,
  type SettingsToggle,
  type SocialSettingsRow,
} from "@/lib/social/profile";
import { Segmented, Switch, cardClass } from "@/components/social/controls";

// Phase 26: Privacy & settings (mockup screen 2). Every choice is a toggle;
// every section has "Show all". Saves as you go -- each change is written
// straight away, and undone on screen if the save fails.

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error" };

export default function PrivacySettingsPage() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const [settings, setSettings] = useState<SocialSettingsRow | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const latest = useRef(0);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchSocialSettings(createClient(), user.id).then(setSettings);
  }, [authLoading, user]);

  if (!settings) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-muted">Loading…</div>;
  }

  async function commit(next: SocialSettingsRow) {
    const prev = settings;
    const seq = ++latest.current;
    setSettings(next);
    setStatus({ kind: "saving" });
    const ok = await saveSocialSettings(createClient(), next);
    if (seq !== latest.current) return; // a newer change is in flight; it decides the status
    if (ok) {
      setStatus({ kind: "saved" });
    } else {
      setSettings(prev);
      setStatus({ kind: "error" });
    }
  }

  const flip = (toggles: SettingsToggle[], on: boolean) => commit(setToggles(settings, toggles, on));

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-10">
      <div className="flex items-center gap-1 py-2">
        <Link href="/profile/edit" aria-label="Back to edit profile" className="flex h-11 w-11 items-center justify-center text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <h1 className="flex-1 text-[17px] font-bold">Privacy &amp; settings</h1>
        <span aria-live="polite" className={`text-xs font-semibold ${status.kind === "error" ? "text-danger" : "text-muted"}`}>
          {status.kind === "saving" ? "Saving…" : status.kind === "saved" ? "Saved" : status.kind === "error" ? "Didn't save. Try again." : ""}
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex items-start gap-3 rounded-[14px] bg-primary-soft p-3.5 text-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /></svg>
          <p className="text-[13px] leading-snug text-ink">
            New accounts start fully private. Friends always see your name and username; everything
            else stays hidden until you turn it on.
          </p>
        </div>

        <section className={`${cardClass} flex flex-col gap-2.5`}>
          <h2 className="text-[15px] font-bold">Who sees your turned-on details</h2>
          <Segmented label="Who sees your turned-on details" options={AUDIENCES} value={settings.audience} onChange={(v) => commit({ ...settings, audience: v })} />
          <p className="text-xs text-muted">
            {settings.audience === "friends"
              ? "Only your friends."
              : settings.audience === "friends_of_friends"
                ? "Your friends, and their friends."
                : "Anyone signed in with a university email."}
          </p>
        </section>

        {SETTINGS_SECTIONS.map((section) => {
          const onCount = section.toggles.filter((t) => isToggleOn(settings, t)).length;
          const allOn = onCount === section.toggles.length;
          return (
            <section key={section.title} className="flex flex-col rounded-card border border-border bg-surface py-1.5 pr-2 pl-4">
              <div className="flex min-h-[52px] items-center gap-2 border-b border-border">
                <div className="flex flex-1 flex-col">
                  <h2 className="text-[15px] font-bold">{section.title}</h2>
                  <span className="text-xs text-muted">{onCount} of {section.toggles.length} on</span>
                </div>
                <span className="text-xs font-bold text-ink">Show all</span>
                <Switch checked={allOn} label={`Show all: ${section.title}`} onChange={(v) => flip(section.toggles, v)} />
              </div>
              {section.toggles.map((t) => (
                <div key={t.id} className="flex min-h-12 items-center gap-2 border-b border-[#f0ece3] last:border-b-0">
                  <span className="flex flex-1 flex-col py-2">
                    <span className="text-sm">{t.label}</span>
                    {t.hint && <span className="text-xs text-muted">{t.hint}</span>}
                  </span>
                  <Switch checked={isToggleOn(settings, t)} label={t.label} onChange={(v) => flip([t], v)} />
                </div>
              ))}
            </section>
          );
        })}

        <p className="px-1 text-xs leading-snug text-muted">
          Push notifications start working once the app can send them (coming soon). Your choices
          here are saved now so they apply from day one.
        </p>
      </div>
    </div>
  );
}

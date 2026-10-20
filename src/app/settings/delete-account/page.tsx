"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DELETE_CONFIRM_WORD, LOCAL_STORAGE_KEYS } from "@/lib/social/accountDeletion";
import { cardClass, inputClass } from "@/components/social/controls";

// Permanently delete your account. Spells out exactly what goes, asks for the
// confirmation word, then calls POST /api/account/delete.
export default function DeleteAccountPage() {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed.trim() === DELETE_CONFIRM_WORD;

  async function deleteAccount() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: DELETE_CONFIRM_WORD }),
      });
    } catch {
      setBusy(false);
      setError("No connection. Nothing was deleted; try again when you're online.");
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setBusy(false);
      setError(body?.error ?? "Couldn't delete your account. Nothing was removed; try again.");
      return;
    }
    // Gone server-side. Clear this browser's copy too, so it can't be merged
    // into whatever account signs in here next.
    for (const key of LOCAL_STORAGE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* storage unavailable: nothing to clear */
      }
    }
    await createClient().auth.signOut().catch(() => {});
    window.location.assign("/welcome");
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-10">
      <div className="flex items-center gap-1 py-2">
        <Link href="/settings/privacy" aria-label="Back to privacy and settings" className="flex h-11 w-11 items-center justify-center text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <h1 className="flex-1 text-[17px] font-bold">Delete account</h1>
      </div>

      <div className="flex flex-col gap-3.5">
        <section className={`${cardClass} flex flex-col gap-2.5 text-sm leading-relaxed`}>
          <p className="font-bold">This can&apos;t be undone. Deleting your account permanently removes:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>your profile, photo, username and privacy settings</li>
            <li>every plan you own, and the votes and comments you left</li>
            <li>your setup answers (host city, semester dates)</li>
            <li>you from any friend&apos;s plan you collaborate on (their plan stays)</li>
            <li>the copy of your plans saved in this browser</li>
          </ul>
          <p className="text-muted">
            Plans you shared with a view link stop working. Want a copy first? Export a plan from
            the Plans tab.
          </p>
        </section>

        <section className={`${cardClass} flex flex-col gap-2.5`}>
          <label htmlFor="confirm" className="text-sm">
            Type <b>{DELETE_CONFIRM_WORD}</b> to confirm.
          </label>
          <input
            id="confirm"
            className={inputClass}
            value={typed}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
          {error && (
            <p className="text-sm font-semibold text-danger" role="alert">
              {error}
            </p>
          )}
          <button type="button" onClick={deleteAccount} disabled={!ready || busy} className="btn btn-lg w-full bg-danger text-white disabled:opacity-50">
            {busy ? "Deleting…" : "Delete my account"}
          </button>
        </section>
      </div>
    </div>
  );
}

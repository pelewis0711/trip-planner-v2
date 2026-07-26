"use client";

// Shared "search your program/university, auto-fill real dates" box --
// used by both the onboarding wizard's Step 5 (sets the DEFAULT semester
// for future new plans) and the Plans tab's per-plan Semester panel (sets
// THIS plan's actual weekends). Previously this only existed inline inside
// OnboardingFlow, which meant the one place that actually changes an
// existing plan's real calendar (SemesterPanel) had no host-university
// field at all -- "put a host university in, nothing updates" was
// literally true there, since the field didn't exist.
import { useMemo, useState } from "react";
import { searchPrograms, toSemesterConfig, type ProgramCalendar } from "@/data/programCalendars";
import type { SemesterConfig } from "@/lib/calc/semester";

export default function ProgramSearchPicker({
  onApply,
}: {
  onApply: (semester: SemesterConfig, program: ProgramCalendar) => void;
}) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState<ProgramCalendar | null>(null);
  const results = useMemo(() => searchPrograms(query), [query]);

  function handlePick(p: ProgramCalendar) {
    onApply(toSemesterConfig(p), p);
    setApplied(p);
    setQuery("");
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-ink">Search your program or university</label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. CEA CAPA Prague, Trinity College Dublin…"
        className="w-full max-w-sm rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-ink placeholder:text-muted"
      />
      {query.trim() && (
        <div className="max-w-sm space-y-0.5 rounded-md border border-border bg-surface p-1.5">
          {results.length ? (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePick(p)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-primary-soft"
              >
                <span className="font-semibold text-ink">{p.name}</span>{" "}
                <span className="text-muted">
                  · {p.city}, {p.country} · {p.term}
                </span>
              </button>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted">No match — enter dates manually below.</p>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted">My program isn&apos;t listed — that&apos;s fine, just edit the dates directly below.</p>

      {applied && (
        <div className="rounded-md border border-primary/30 bg-primary-soft px-3 py-2 text-xs text-ink">
          <p>
            ✓ Auto-filled from <b>{applied.name}</b> ({applied.term})
            {applied.sourceUrl && (
              <>
                {" "}
                —{" "}
                <a href={applied.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
                  source
                </a>
              </>
            )}
          </p>
          <p className="mt-0.5 text-muted">{applied.verifyNote}</p>
        </div>
      )}
    </div>
  );
}

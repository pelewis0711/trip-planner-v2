"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { fetchUserSettings } from "@/lib/supabase/settings";
import {
  fetchOwnProfile,
  isUsernameAvailable,
  removeAvatarFile,
  saveOwnProfile,
  uploadAvatar,
} from "@/lib/supabase/social";
import {
  BUDGET_LEVELS,
  EMPTY_DRAFT,
  GENDERS,
  LIMITS,
  daysUntilUsernameChange,
  normalizeUsername,
  profileSaveErrorMessage,
  rowToDraft,
  usernameProblem,
  validateDraft,
  type DraftErrors,
  type ProfileDraft,
  type PublicProfileRow,
} from "@/lib/social/profile";
import { PERSONAL_INTERESTS, TRAVEL_INTERESTS } from "@/data/interests";
import { AvatarError, resizeAvatar } from "@/lib/social/avatar";
import Avatar from "@/components/social/Avatar";
import { Chip, Segmented, cardClass, inputClass, labelClass } from "@/components/social/controls";

// Phase 26: create or edit your social profile (mockup screen 1). First visit
// is "Create your profile", which needs the 18+ confirmation; host city and
// semester dates are prefilled from onboarding. Who sees each field is set on
// /settings/privacy -- everything starts private.

type Availability = "idle" | "checking" | "available" | "taken" | "unknown";

export default function EditProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  const [existing, setExisting] = useState<PublicProfileRow | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [adult, setAdult] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [newLanguage, setNewLanguage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Load: own profile if it exists, otherwise a draft prefilled from onboarding.
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const supabase = createClient();
      const [row, settings] = await Promise.all([fetchOwnProfile(supabase, user.id), fetchUserSettings(supabase, user.id)]);
      if (row) {
        setExisting(row);
        setDraft(rowToDraft(row));
        return;
      }
      const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
      setDraft({
        ...EMPTY_DRAFT,
        display_name: meta?.full_name ?? meta?.name ?? "",
        host_city: settings?.home_city ?? "",
        host_country: settings?.home_country ?? "",
        host_university: settings?.host_university ?? "",
        home_university: settings?.home_university ?? "",
        abroad_start: settings?.default_semester?.start ?? "",
        abroad_end: settings?.default_semester?.end ?? "",
      });
    })();
  }, [authLoading, user]);

  // Live "is this username free?" check, debounced.
  const normalized = draft ? normalizeUsername(draft.username) : "";
  useEffect(() => {
    if (!draft || usernameProblem(draft.username) || normalized === existing?.username) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setAvailability("checking");
      const ok = await isUsernameAvailable(createClient(), normalized);
      if (!cancelled) setAvailability(ok === null ? "unknown" : ok ? "available" : "taken");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when the name itself changes
  }, [normalized, existing?.username]);

  // Free the preview's blob: URL when it's replaced or the page closes.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  if (!draft || !user) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-muted">Loading…</div>;
  }

  const isNew = !existing;
  const lockDays = existing ? daysUntilUsernameChange(existing.username_changed_at) : 0;
  const usernameLocked = lockDays > 0;
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => {
    setDraft({ ...draft, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };
  const toggleIn = (k: "travel_interests" | "personal_interests", slug: string) =>
    set(k, draft[k].includes(slug) ? draft[k].filter((s) => s !== slug) : [...draft[k], slug]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    try {
      const blob = await resizeAvatar(file);
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
      setRemovePhoto(false);
    } catch (e) {
      setPhotoError(e instanceof AvatarError ? e.message : "Couldn't use that photo.");
    }
  }

  async function save() {
    if (!draft || !user) return;
    const found = validateDraft(draft, { isNew, adultConfirmed: adult });
    if (availability === "taken" && !found.username) found.username = "That username is taken.";
    setErrors(found);
    setSaveError(null);
    if (Object.values(found).some(Boolean)) {
      setSaveError("Fix the highlighted fields first.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    let avatarPath: string | null | undefined = undefined;
    if (photo) {
      avatarPath = await uploadAvatar(supabase, user.id, photo.blob);
      if (!avatarPath) {
        setSaving(false);
        setSaveError("Your photo didn't upload. Try again, or save without it.");
        return;
      }
    } else if (removePhoto) {
      avatarPath = null;
    }

    const result = await saveOwnProfile(supabase, user.id, draft, { isNew, avatarPath });
    setSaving(false);
    if (!result.ok) {
      if (avatarPath) await removeAvatarFile(supabase, avatarPath);
      setSaveError(profileSaveErrorMessage(result.error));
      return;
    }
    // Old photo file is no longer referenced: clean it up.
    const oldPath = existing?.avatar_path;
    if (oldPath && avatarPath !== undefined && avatarPath !== oldPath) await removeAvatarFile(supabase, oldPath);
    router.push(`/u/${result.row.username}`);
  }

  const err = (k: keyof DraftErrors) =>
    errors[k] ? (
      <p className="text-xs font-semibold text-danger" role="alert">
        {errors[k]}
      </p>
    ) : null;

  const shownAvatarPath = removePhoto ? null : existing?.avatar_path;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-10">
      <div className="flex items-center justify-between gap-3 py-2">
        <Link href={existing ? `/u/${existing.username}` : "/"} className="flex h-11 items-center px-1 text-sm font-semibold text-muted">
          Cancel
        </Link>
        <h1 className="text-[17px] font-bold">{isNew ? "Create your profile" : "Edit profile"}</h1>
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-md">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        <section className="flex flex-col items-center gap-2.5 py-1">
          <Avatar path={shownAvatarPath} previewUrl={photo?.url} name={draft.display_name || "?"} size={96} />
          <div className="flex gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} className="btn btn-secondary btn-sm">
              {shownAvatarPath || photo ? "Change photo" : "Add photo"}
            </button>
            {(shownAvatarPath || photo) && (
              <button
                type="button"
                onClick={() => {
                  if (photo) URL.revokeObjectURL(photo.url);
                  setPhoto(null);
                  setRemovePhoto(true);
                }}
                className="btn btn-ghost btn-sm"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Choose a profile photo"
            onChange={(e) => {
              pickPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {photoError && <p className="text-xs font-semibold text-danger">{photoError}</p>}
        </section>

        <Link
          href="/settings/privacy"
          className="flex min-h-14 items-center gap-3 rounded-[14px] bg-primary-soft px-3.5 text-primary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-bold">Privacy &amp; visibility</span>
            <span className="text-xs text-ink">Everything below starts private. Choose what people see.</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>

        <section className={`${cardClass} flex flex-col gap-3.5`}>
          <h2 className="text-[15px] font-bold">Basics</h2>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="f-name" className={labelClass}>Name</label>
              <span className="text-[11px] font-semibold text-muted">Always shown to friends</span>
            </div>
            <input id="f-name" className={inputClass} value={draft.display_name} maxLength={LIMITS.displayName} autoComplete="name" onChange={(e) => set("display_name", e.target.value)} />
            {err("display_name")}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="f-user" className={labelClass}>Username</label>
              <span className="text-[11px] font-semibold text-muted">Always shown to friends</span>
            </div>
            <div className={`${inputClass} flex items-center ${usernameLocked ? "opacity-60" : ""}`}>
              <span className="text-muted">@</span>
              <input
                id="f-user"
                className="h-full min-w-0 flex-1 bg-transparent pl-0.5 focus:outline-none"
                value={draft.username}
                maxLength={31}
                disabled={usernameLocked}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => {
                  set("username", e.target.value.replace(/^@+/, "").toLowerCase());
                  setAvailability("idle");
                }}
              />
            </div>
            {usernameLocked ? (
              <span className="text-xs text-muted">You can change your username again in {lockDays} day{lockDays === 1 ? "" : "s"}.</span>
            ) : errors.username ? (
              err("username")
            ) : (
              <UsernameStatus draft={draft} existing={existing} availability={availability} />
            )}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className={`${labelClass} mb-2`}>Gender</legend>
            <div className="flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <Chip key={g.value} selected={draft.gender === g.value} onClick={() => set("gender", draft.gender === g.value ? null : g.value)}>
                  {g.label}
                </Chip>
              ))}
            </div>
            {draft.gender === "self_describe" && (
              <input aria-label="Describe your gender" className={inputClass} placeholder="In your own words" maxLength={LIMITS.genderCustom} value={draft.gender_custom} onChange={(e) => set("gender_custom", e.target.value)} />
            )}
            {err("gender_custom")}
          </fieldset>
        </section>

        <section className={`${cardClass} flex flex-col gap-3.5`}>
          <h2 className="text-[15px] font-bold">Study abroad</h2>
          <TextField id="f-city" label="Host city" value={draft.host_city} max={LIMITS.shortText} onChange={(v) => set("host_city", v)} error={err("host_city")} />
          <TextField id="f-host" label="Host university" value={draft.host_university} max={LIMITS.longText} placeholder="Where you're studying abroad" onChange={(v) => set("host_university", v)} error={err("host_university")} />
          <TextField id="f-prog" label="Program or provider" value={draft.program} max={LIMITS.longText} placeholder="e.g. CEA, CIEE, direct exchange" onChange={(v) => set("program", v)} error={err("program")} />
          <div className="grid grid-cols-2 gap-2.5">
            <TextField id="f-home" label="Home university" value={draft.home_university} max={LIMITS.longText} onChange={(v) => set("home_university", v)} error={err("home_university")} />
            <TextField id="f-grad" label="Graduation year" value={draft.grad_year} max={4} inputMode="numeric" onChange={(v) => set("grad_year", v.replace(/\D/g, ""))} error={err("grad_year")} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <DateField id="f-start" label="Abroad from" value={draft.abroad_start} onChange={(v) => set("abroad_start", v)} />
            <DateField id="f-end" label="Until" value={draft.abroad_end} onChange={(v) => set("abroad_end", v)} />
          </div>
          {err("abroad_end")}

          <div className="flex flex-col gap-2">
            <span className={labelClass}>Languages</span>
            <div className="flex flex-wrap gap-2">
              {draft.languages.map((l) => (
                <span key={l} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary-soft pr-1.5 pl-3.5 text-[13px] font-semibold text-primary">
                  {l}
                  <button type="button" aria-label={`Remove ${l}`} onClick={() => set("languages", draft.languages.filter((x) => x !== l))} className="flex h-7 w-7 items-center justify-center rounded-full">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </span>
              ))}
            </div>
            {draft.languages.length < LIMITS.languages && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const l = newLanguage.trim();
                  if (l && !draft.languages.some((x) => x.toLowerCase() === l.toLowerCase())) set("languages", [...draft.languages, l]);
                  setNewLanguage("");
                }}
              >
                <input aria-label="Add a language" className={inputClass} placeholder="Add a language" maxLength={LIMITS.languageLen} value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} />
                <button type="submit" className="btn btn-secondary btn-md">Add</button>
              </form>
            )}
            {err("languages")}
          </div>

          <fieldset>
            <legend className={`${labelClass} mb-2`}>Budget level</legend>
            <Segmented label="Budget level" options={BUDGET_LEVELS} value={draft.budget_level} onChange={(v) => set("budget_level", draft.budget_level === v ? null : v)} />
          </fieldset>
        </section>

        <section className={`${cardClass} flex flex-col gap-3`}>
          <div className="flex items-baseline justify-between">
            <label htmlFor="f-bio" className="text-[15px] font-bold">Bio</label>
            <span className="text-xs text-muted">{draft.bio.length} / {LIMITS.bio}</span>
          </div>
          <textarea
            id="f-bio"
            rows={4}
            maxLength={LIMITS.bio}
            placeholder="Who you are, how you like to travel, what you want in a travel crew"
            className="w-full resize-none rounded-xl border border-border bg-[#fbfaf6] px-3.5 py-3 text-[15px] leading-snug text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            value={draft.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
          {err("bio")}

          <div className="flex flex-col gap-2 pt-1">
            <span className={labelClass}>Your own details</span>
            {draft.custom_details.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input aria-label={`Detail ${i + 1} label`} className={`${inputClass} w-32 shrink-0 font-semibold`} placeholder="Label" maxLength={LIMITS.customLabel} value={c.label}
                  onChange={(e) => set("custom_details", draft.custom_details.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input aria-label={`Detail ${i + 1} answer`} className={inputClass} placeholder="Answer" maxLength={LIMITS.customValue} value={c.value}
                  onChange={(e) => set("custom_details", draft.custom_details.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <button type="button" aria-label={`Remove detail ${i + 1}`} onClick={() => set("custom_details", draft.custom_details.filter((_, j) => j !== i))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:text-danger">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                </button>
              </div>
            ))}
            {draft.custom_details.length < LIMITS.customDetails && (
              <button type="button" onClick={() => set("custom_details", [...draft.custom_details, { label: "", value: "" }])}
                className="h-11 rounded-xl border border-dashed border-[#b9b2a3] text-[13px] font-semibold text-ink hover:border-primary">
                + Add your own detail
              </button>
            )}
            {err("custom_details")}
          </div>
        </section>

        <InterestSection title="Travel interests" list={TRAVEL_INTERESTS} picked={draft.travel_interests} onToggle={(s) => toggleIn("travel_interests", s)} />
        <InterestSection title="Personal interests" list={PERSONAL_INTERESTS} picked={draft.personal_interests} onToggle={(s) => toggleIn("personal_interests", s)} />

        {isNew && (
          <label className={`${cardClass} flex cursor-pointer items-start gap-3`}>
            <input type="checkbox" checked={adult} onChange={(e) => { setAdult(e.target.checked); setErrors({ ...errors, adult: undefined }); }} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
            <span className="text-sm leading-snug">
              <b>I&apos;m 18 or older.</b>{" "}WhereNext&apos;s social features are for adults only.
              {err("adult")}
            </span>
          </label>
        )}

        {saveError && (
          <p className="rounded-xl bg-accent-soft px-3.5 py-3 text-sm font-semibold text-accent-hover" role="alert">
            {saveError}
          </p>
        )}
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-lg w-full">
          {saving ? "Saving…" : isNew ? "Create profile" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function UsernameStatus({ draft, existing, availability }: { draft: ProfileDraft; existing: PublicProfileRow | null; availability: Availability }) {
  const problem = draft.username ? usernameProblem(draft.username) : null;
  const unchanged = existing && normalizeUsername(draft.username) === existing.username;
  let text = "Lowercase letters, numbers, periods and underscores. Changeable once every 30 days.";
  let tone = "text-muted";
  if (draft.username && problem) {
    text = problem;
    tone = "text-danger";
  } else if (draft.username && !unchanged) {
    if (availability === "checking") text = "Checking…";
    else if (availability === "available") { text = "Available"; tone = "text-success"; }
    else if (availability === "taken") { text = "Taken. Try another."; tone = "text-danger"; }
  }
  return <span className={`text-xs font-semibold ${tone}`} aria-live="polite">{text}</span>;
}

function TextField({
  id, label, value, onChange, max, placeholder, inputMode, error,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; max: number;
  placeholder?: string; inputMode?: "numeric"; error?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} className={inputClass} value={value} maxLength={max} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      {error}
    </div>
  );
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} type="date" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function InterestSection({
  title, list, picked, onToggle,
}: {
  title: string; list: { slug: string; label: string }[]; picked: string[]; onToggle: (slug: string) => void;
}) {
  return (
    <section className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <span className="text-xs text-muted">{picked.length} picked</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((i) => (
          <Chip key={i.slug} selected={picked.includes(i.slug)} onClick={() => onToggle(i.slug)}>
            {i.label}
          </Chip>
        ))}
      </div>
    </section>
  );
}

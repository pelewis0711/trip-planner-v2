"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ACADEMIC_DOMAIN_PATTERNS,
  NOT_ACADEMIC_MESSAGE,
  SIGNUP_FAILED_MESSAGE,
  SUPPORT_EMAIL,
  classifySignupError,
  emailDomain,
  isAcademicEmail,
  loadAcademicPatterns,
  type SignupRejection,
} from "@/lib/auth/academicEmail";
import { safeNext } from "@/lib/auth/gate";

/** Reads the ?error= that /auth/callback sets after a refused Google sign-up. */
function rejectionFromUrl(value: string | null): SignupRejection | null {
  return value === "not_academic" || value === "signup_failed" ? value : null;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only ever a path on this site -- an unchecked ?next= is an open redirect.
  const next = safeNext(searchParams.get("next"));
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(
    urlError === "auth" ? "Sign-in didn't finish. Please try again." : null
  );
  const [rejection, setRejection] = useState<SignupRejection | null>(() => rejectionFromUrl(urlError));
  const [notAcademicHint, setNotAcademicHint] = useState(false);
  const [patterns, setPatterns] = useState<readonly string[]>(ACADEMIC_DOMAIN_PATTERNS);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [router, next]);

  useEffect(() => {
    loadAcademicPatterns().then(setPatterns);
  }, []);

  function handleEmailBlur() {
    // Only once it's a whole address -- no warning halfway through typing one.
    setNotAcademicHint(emailDomain(email) !== null && !isAcademicEmail(email, patterns));
  }

  function callbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    if (next !== "/") url.searchParams.set("next", next);
    return url.toString();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRejection(null);
    const address = email.trim();
    const academic = isAcademicEmail(address, patterns);
    setLoading("email");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: callbackUrl(),
        // A non-school address may still SIGN IN -- accounts from before the
        // university-email rule are grandfathered -- but may not create an account.
        // With no matching account, Supabase refuses: "Signups not allowed for otp".
        shouldCreateUser: academic,
      },
    });
    setLoading(null);
    if (!error) {
      setSent(true);
      return;
    }
    const reason =
      !academic && (error.code === "otp_disabled" || error.message.includes("Signups not allowed"))
        ? "not_academic"
        : classifySignupError(error.message);
    if (reason) {
      setNotAcademicHint(false);
      setRejection(reason);
    } else {
      setError(error.message);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
    // on success the browser navigates away to Google, so no further state change here
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-card border border-border bg-surface p-8">
        <h1 className="font-heading text-xl font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to start planning. New accounts need a university email address — with Google,
          pick your school account.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            Check <span className="font-semibold">{email}</span> for a sign-in link.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading !== null}
              className="btn btn-secondary btn-lg mt-6 w-full"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                required
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setNotAcademicHint(false);
                  setRejection(null);
                  setError(null);
                }}
                onBlur={handleEmailBlur}
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />
              {notAcademicHint && !rejection && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-xs text-warning">
                  <p>{NOT_ACADEMIC_MESSAGE}</p>
                  <p className="mt-1 text-muted">
                    Already have an account with this address? Send the link anyway — existing
                    accounts still sign in.
                  </p>
                </div>
              )}
              <button type="submit" disabled={loading !== null} className="btn btn-primary btn-lg w-full">
                {loading === "email" ? "Sending…" : "Send me a sign-in link"}
              </button>
            </form>
          </>
        )}

        {rejection && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <p>{rejection === "not_academic" ? NOT_ACADEMIC_MESSAGE : SIGNUP_FAILED_MESSAGE}</p>
            <p className="mt-2 text-ink">
              {rejection === "not_academic"
                ? "School not recognized? Email Parker at "
                : "Used your university email and still seeing this? Email Parker at "}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Add my school to Semesterly")}`}
                className="font-medium text-primary underline"
              >
                {SUPPORT_EMAIL}
              </a>
              {rejection === "not_academic" ? " and your school's domain will be added." : "."}
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <p className="mt-6 text-xs text-muted">
          No password needed — we&apos;ll email you a link. Your plans on this
          device carry over automatically once you&apos;re signed in.
        </p>
      </div>
    </div>
  );
}

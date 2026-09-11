import type { Metadata } from "next";
import Link from "next/link";
import { safeNext } from "@/lib/auth/gate";

// The signed-out front door. src/proxy.ts sends every signed-out page request
// here (with ?next= set to where they were headed) and sends signed-in visitors
// straight on into the app, so this page only ever renders for someone who
// isn't signed in: no Header, no plan store, nothing that assumes an account.
export const metadata: Metadata = {
  title: "Semesterly — plan your semester abroad",
};

const POINTS: [emoji: string, strong: string, rest: string][] = [
  ["📅", "Your actual calendar", " — every free weekend and break, built from your program's dates."],
  ["💸", "Weekend-by-weekend costs", " — flights, stays, food and activities, per person or split with friends."],
  ["✈️", "Live flight prices", " shown alongside the estimates, wherever real fares exist."],
  ["🗺️", "212 trips across 43 countries", ", with a Schengen-day tracker so you don't overstay."],
];

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(typeof next === "string" ? next : null);
  const signInHref = destination === "/" ? "/login" : `/login?${new URLSearchParams({ next: destination })}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-heading text-base font-bold text-white">
          S
        </span>
        <span className="font-heading text-xl leading-none font-bold text-ink">Semesterly</span>
      </div>

      <h1 className="mt-6 font-heading text-2xl leading-tight font-bold text-ink sm:text-3xl">
        Plan every weekend of your semester abroad.
      </h1>
      <p className="mt-3 text-sm text-muted sm:text-base">
        Semesterly is a trip planner for study-abroad students. It lays out your real academic
        calendar, prices each weekend trip, and checks live flight fares — so you can see what the
        whole semester costs before you book anything.
      </p>

      <ul className="mt-6 space-y-2.5 rounded-card border border-border bg-surface p-5 text-sm text-muted">
        {POINTS.map(([emoji, strong, rest]) => (
          <li key={strong} className="flex gap-2.5">
            <span aria-hidden>{emoji}</span>
            <span>
              <b className="text-ink">{strong}</b>
              {rest}
            </span>
          </li>
        ))}
      </ul>

      <Link href={signInHref} className="btn btn-primary btn-lg mt-7 w-full">
        Sign in with your school email
      </Link>
      <p className="mt-3 text-center text-xs text-muted">
        Semesterly is for students, so signing up needs a university email address — usually one
        ending in .edu.{" "}
        <Link href="/privacy" className="font-medium text-primary hover:underline">
          What we store
        </Link>
      </p>
    </div>
  );
}

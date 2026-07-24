import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Semesterly",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="rounded-card border border-border bg-surface p-6 sm:p-8">
        <h1 className="font-heading text-xl font-semibold text-ink">Privacy, in plain English</h1>

        <div className="mt-5 space-y-4 text-sm text-muted">
          <p>
            <b className="text-ink">By default, everything stays on your device.</b> Your home city,
            semester dates, trips, and budgets are saved only in your own browser (localStorage). No
            account is required to use the planner, and nothing is sent to a server or shared with
            anyone.
          </p>
          <p>
            <b className="text-ink">If you sign in</b> (email link or Google — optional), your plans
            sync to a private database tied to your account, so you can pick up where you left off on
            another device. We store your email address to identify your account, plus whatever plan
            details you&apos;ve entered — nothing more.
          </p>
          <p>
            <b className="text-ink">If you share a plan</b> with a link, anyone who has that link can
            view it (and, for a &ldquo;collaborate&rdquo; link, edit it and leave votes/comments). You
            can turn sharing off anytime from a plan&apos;s card on the Plans tab.
          </p>
          <p>
            <b className="text-ink">We don&apos;t sell or share your data</b> with third parties.
            Booking links (flights, hotels, activities) take you to those sites directly — they have
            their own separate privacy policies.
          </p>
        </div>
      </div>
    </div>
  );
}

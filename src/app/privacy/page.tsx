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
            {/* Explicit {" "} after each </b>: the build drops a plain leading space
                when the text that follows contains an HTML entity (&apos; etc.). */}
            <b className="text-ink">You need an account to use Semesterly.</b>{" "}You sign in with an
            email link or Google, and new accounts need a university email address. We store that
            email address to identify your account.
          </p>
          <p>
            <b className="text-ink">Your plans live on your device and in your account.</b>{" "}Your setup
            answers (host city, universities, semester dates), trips, and budgets are saved in your
            browser (so the app works offline) and synced to a private database tied to your account,
            so you can pick up where you left off on another device. That&apos;s everything we keep, and
            nobody else can see it unless you share a plan. Signing
            out doesn&apos;t erase the copy saved in that browser, so be careful on a shared computer.
          </p>
          <p>
            <b className="text-ink">If you share a plan</b>{" "}with a view link, anyone who has that link
            can see that plan — no account needed. A &ldquo;collaborate&rdquo; link lets people edit it
            and leave votes/comments once they sign in. You can turn sharing off anytime from a
            plan&apos;s card on the Plans tab.
          </p>
          <p>
            <b className="text-ink">We don&apos;t sell or share your data</b>{" "}with third parties.
            Booking links (flights, hotels, activities) take you to those sites directly — they have
            their own separate privacy policies.
          </p>
        </div>
      </div>
    </div>
  );
}

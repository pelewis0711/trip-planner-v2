"use client";

import Link from "next/link";

// Route-segment error boundary. Next.js already keeps stack traces out of
// the production DOM by default even without this file -- this just swaps
// the generic built-in error screen for one that matches the app and never
// shows `error.message` (which could echo back unexpected internal detail
// depending on where the throw came from) to the visitor.
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="rounded-card border-2 border-dashed border-border p-8">
        <h2 className="font-heading text-lg font-semibold text-ink">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted">
          That&apos;s on us, not you — your plans are safe. Try again, or head back to the homepage.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink hover:border-primary/50"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

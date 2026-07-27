"use client";

// Catches errors in the root layout itself, which the regular error.tsx
// boundary can't (it only wraps children of the layout, not the layout).
// Has to render its own <html>/<body> since it fully replaces the root
// layout when triggered -- kept intentionally plain (no Tailwind classes
// depending on globals.css having loaded) since this is the last-resort
// fallback if something in the app shell itself broke.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ marginTop: "0.5rem", color: "#6f6a85", fontSize: "0.875rem" }}>
            That&apos;s on us, not you — your plans are safe. Try reloading.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              borderRadius: "9999px",
              background: "#5a4ad1",
              color: "#fff",
              padding: "0.65rem 1.35rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 0 #4a3bb8, 0 4px 10px rgba(90,74,209,0.2)",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

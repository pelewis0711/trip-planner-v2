"use client";

import { useState, useSyncExternalStore } from "react";

const DISMISSED_KEY = "installPromptDismissed";

function noopSubscribe() {
  return () => {};
}
const getIsIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const getIsIOSServer = () => false;
const getIsStandalone = () => window.matchMedia("(display-mode: standalone)").matches;
const getIsStandaloneServer = () => false;

export default function InstallPrompt() {
  // getServerSnapshot always returns false, so this renders nothing during
  // SSR/first paint and only appears after hydration on an actual iOS
  // Safari browser -- no server/client mismatch to worry about.
  const isIOS = useSyncExternalStore(noopSubscribe, getIsIOS, getIsIOSServer);
  const isStandalone = useSyncExternalStore(noopSubscribe, getIsStandalone, getIsStandaloneServer);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "1"
  );

  if (!isIOS || isStandalone || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary-soft px-4 py-2.5 text-[12.5px] text-primary">
        <span>
          📲 Install this app: tap the <b>Share</b> button in Safari, then{" "}
          <b>Add to Home Screen</b>. It&apos;ll work offline once installed.
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md border border-primary/40 px-2 py-1 font-semibold text-primary"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

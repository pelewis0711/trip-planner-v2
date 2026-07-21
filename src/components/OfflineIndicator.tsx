"use client";

import { useSyncExternalStore } from "react";
import { usePlanStore } from "@/lib/store/plan";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;

export default function OfflineIndicator() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pendingCount = usePlanStore((s) => s.pendingSyncIds.length);

  if (!online) {
    return (
      <div className="shrink-0 rounded-lg border border-amber-500/50 px-2.5 py-1.5 text-xs font-semibold text-amber-400">
        📴 Offline — changes save here, sync once you&apos;re back online
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="shrink-0 rounded-lg border border-sky-500/50 px-2.5 py-1.5 text-xs font-semibold text-sky-400">
        🔄 Syncing {pendingCount} change{pendingCount > 1 ? "s" : ""}…
      </div>
    );
  }

  return null;
}

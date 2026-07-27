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
      <div className="shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning">
        📴 Offline — changes save here, sync once you&apos;re back online
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="shrink-0 rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary">
        🔄 Syncing {pendingCount} change{pendingCount > 1 ? "s" : ""}…
      </div>
    );
  }

  return null;
}

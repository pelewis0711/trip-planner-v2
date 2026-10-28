"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
/** Data is account-scoped. A late response after account switching is ignored. */
export function useGroupData<T>(
  name: string,
  args: Record<string, unknown> = {},
) {
  const userId = useAuthStore((s) => s.user?.id);
  const key = JSON.stringify(args);
  const [state, setState] = useState<{
    owner: string;
    key: string;
    data: T | null;
    error: string;
    loaded: boolean;
  }>();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    let seq = 0;
    const load = async () => {
      const n = ++seq;
      try {
        const data = await groupRpc<T>(createClient(), name, JSON.parse(key));
        if (live && n === seq)
          setState({ owner: userId, key, data, error: "", loaded: true });
      } catch (e) {
        if (live && n === seq)
          setState({
            owner: userId,
            key,
            data: null,
            error: e instanceof Error ? e.message : "Could not connect.",
            loaded: true,
          });
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    window.addEventListener("focus", load);
    window.addEventListener("groups-changed", load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("groups-changed", load);
    };
  }, [name, key, userId, version]);
  const current =
    state?.owner === userId && state?.key === key ? state : undefined;
  return {
    data: current?.data ?? null,
    error: current?.error ?? "",
    loaded: current?.loaded ?? false,
    refresh,
  };
}
export function groupsChanged() {
  window.dispatchEvent(new Event("groups-changed"));
  window.dispatchEvent(new Event("chat-inbox-changed"));
}

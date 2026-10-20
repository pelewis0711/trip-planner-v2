"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { fetchOwnProfile } from "@/lib/supabase/social";

// Phase 26: "Profile" in the menu. Your profile page if you have one,
// otherwise straight to creating it.
export default function MyProfileRedirect() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchOwnProfile(createClient(), user.id).then((row) => {
      router.replace(row ? `/u/${row.username}` : "/profile/edit");
    });
  }, [authLoading, user, router]);

  return <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-muted">Loading…</div>;
}

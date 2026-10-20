"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { avatarObjectUrl } from "@/lib/supabase/social";
import { initials } from "@/lib/social/profile";

// A profile photo from the private "avatars" bucket, or initials when there's
// no photo (or the viewer isn't allowed to see it -- the Storage policy
// decides, so a hidden photo simply never downloads). `previewUrl` shows a
// just-picked photo before it's uploaded.
export default function Avatar({
  path,
  name,
  size = 96,
  previewUrl,
}: {
  path?: string | null;
  name: string;
  size?: number;
  previewUrl?: string | null;
}) {
  const [loaded, setLoaded] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path || previewUrl) return;
    let cancelled = false;
    let made: string | null = null;
    avatarObjectUrl(createClient(), path).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      made = url;
      if (url) setLoaded({ path, url });
    });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [path, previewUrl]);

  const src = previewUrl ?? (loaded && loaded.path === path ? loaded.url : null);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a blob: URL; next/image can't optimize it
      <img
        src={src}
        alt=""
        style={style}
        className="shrink-0 rounded-full border-[3px] border-surface object-cover shadow-[0_2px_10px_rgba(35,57,45,0.12)]"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full border-[3px] border-surface bg-primary-soft font-heading font-semibold text-primary shadow-[0_2px_10px_rgba(35,57,45,0.12)]"
    >
      {initials(name)}
    </span>
  );
}

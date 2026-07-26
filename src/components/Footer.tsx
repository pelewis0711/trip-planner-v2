import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border px-4 py-4 text-center text-xs text-muted sm:px-6">
      <Link href="/privacy" className="hover:text-primary hover:underline">
        Privacy — what we store
      </Link>
      <span aria-hidden className="text-border">·</span>
      <a
        href="https://unsplash.com?utm_source=semesterly&utm_medium=referral"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary hover:underline"
      >
        Photos via Unsplash
      </a>
    </footer>
  );
}

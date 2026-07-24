import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border px-4 py-4 text-center text-xs text-muted sm:px-6">
      <Link href="/privacy" className="hover:text-primary hover:underline">
        Privacy — what we store
      </Link>
    </footer>
  );
}

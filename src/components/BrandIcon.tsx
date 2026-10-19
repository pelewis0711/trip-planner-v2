// The WhereNext mark (Phase 24): a simple line-drawn compass, sitting next to
// the serif wordmark in every header. Inherits the text color, so it follows
// the primary token wherever it's placed.
export default function BrandIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-primary ${className}`}
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z" />
    </svg>
  );
}

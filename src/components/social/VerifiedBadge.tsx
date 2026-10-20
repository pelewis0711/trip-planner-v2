// Shown next to a name when the account signed up with a university email
// (get_public_profile's `verified`, migration 0014). The tooltip and label say
// exactly what it means -- an academic address, not proof of enrollment.
export default function VerifiedBadge({ size = 17 }: { size?: number }) {
  return (
    <span title="Verified student: signed up with a university email" className="inline-flex">
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Verified student">
        <circle cx="12" cy="12" r="10" fill="var(--color-primary)" />
        <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

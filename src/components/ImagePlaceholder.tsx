// Fallback for any trip with no fetched photo -- never a broken <img> or a
// generic stock photo. Honestly empty (a subtle icon), with an optional
// label (e.g. the city name) so it still reads as "this trip", not just
// "an image is missing".
export default function ImagePlaceholder({
  ratio = "aspect-[4/3]",
  className = "",
  label,
}: {
  ratio?: string;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`flex ${ratio} flex-col items-center justify-center gap-1 rounded-[calc(var(--radius-card)-4px)] bg-primary-soft px-2 ${className}`}
    >
      <span className="text-2xl opacity-40" aria-hidden>
        🖼️
      </span>
      {label && (
        <span className="line-clamp-2 text-center text-[11px] font-semibold text-primary/70">{label}</span>
      )}
    </div>
  );
}

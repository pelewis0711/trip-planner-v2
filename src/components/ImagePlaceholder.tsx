// Reserved space for a future trip/destination photo -- no photos are
// sourced yet, this just designs the slot so one can be dropped in later
// without a layout change. Honestly empty (a subtle icon + label), never a
// broken <img> or a placeholder stock photo.
export default function ImagePlaceholder({
  ratio = "aspect-[4/3]",
  className = "",
}: {
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex ${ratio} items-center justify-center rounded-[calc(var(--radius-card)-4px)] bg-primary-soft ${className}`}
    >
      <span className="text-2xl opacity-40" aria-hidden>
        🖼️
      </span>
    </div>
  );
}

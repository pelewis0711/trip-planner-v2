"use client";

// Small shared controls for the Phase 26 social screens, matching the
// "WhereNext — Group planning" mockups: a switch, a chip, and a segmented row.

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50"
    >
      <span
        className={`relative block h-7 w-[46px] rounded-full transition-colors ${checked ? "bg-primary" : "bg-[#8e887c]"}`}
      >
        <span
          className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-[left] ${
            checked ? "left-[21px]" : "left-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-10 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
        selected
          ? "border-primary bg-primary text-white"
          : "border-[#d9d3c6] bg-surface text-primary hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-xl border px-1.5 text-[13px] leading-tight font-bold transition-colors ${
              on ? "border-primary bg-primary text-white" : "border-[#d9d3c6] bg-surface text-primary hover:border-primary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const inputClass =
  "h-[46px] w-full rounded-xl border border-border bg-[#fbfaf6] px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-primary focus:outline-none";

export const labelClass = "text-xs font-semibold text-muted";

export const cardClass = "rounded-card border border-border bg-surface p-4";

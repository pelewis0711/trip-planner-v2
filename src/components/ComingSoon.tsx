export default function ComingSoon({ title, stage }: { title: string; stage: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
        <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
        <p className="mt-2 text-sm text-zinc-500">Coming in {stage} of the rebuild.</p>
      </div>
    </div>
  );
}

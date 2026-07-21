const CARDS = [
  {
    title: "✈️ Flights",
    body: "Sweet spot: 4–8 weeks out. Budget airlines climb steeply in the last 2 weeks. Fly Tue/Wed to save. Holiday weekends (St Pat's, Easter/spring break) → 2–3 months. Set fare alerts.",
  },
  {
    title: "🚆 Trains & buses",
    body: "Regional/short routes: buy anytime, prices are flat. High-speed & scenic (Spain AVE, Italy Frecce, France TGV, Swiss panoramic): cheapest the day booking opens (~2–3 months). Reserve Eurail seats early on popular lines.",
  },
  {
    title: "🛏️ Stays",
    body: "Good hostels/Airbnbs: 3–6 weeks ahead; event weekends 2–3 months. Choose free-cancellation rates and rebook if the price drops. Split an Airbnb with the group on longer trips.",
  },
  {
    title: "🎟️ Activities",
    body: "Most are walk-up. Timed-entry icons (Alhambra, Sagrada Família, Last Supper, Anne Frank House, Vatican) sell out — book 3–8 weeks ahead, some 1–3 months. GetYourGuide/Viator have free cancellation.",
  },
];

export default function CheatSheet() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-base font-semibold text-zinc-100">🗓️ When to book — cheat sheet</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Rules of thumb for European student travel. Every trip below also has its own booking links
        and a tailored timing tip.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <div key={c.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
            <b className="block text-sm text-zinc-100">{c.title}</b>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

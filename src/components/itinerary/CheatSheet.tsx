function cards(studyingInEurope: boolean) {
  return [
    {
      title: "✈️ Flights",
      body: "Sweet spot: 4–8 weeks out. Budget airlines climb steeply in the last 2 weeks. Fly Tue/Wed to save. Holiday weekends → 2–3 months. Set fare alerts.",
    },
    {
      title: "🚆 Trains & buses",
      body:
        "Regional/short routes: buy anytime, prices are flat. High-speed & scenic (Spain AVE, Italy Frecce, France TGV, Swiss panoramic): cheapest the day booking opens (~2–3 months)." +
        (studyingInEurope ? " Reserve Eurail seats early on popular lines." : ""),
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
}

export default function CheatSheet({ studyingInEurope = true }: { studyingInEurope?: boolean }) {
  const CARDS = cards(studyingInEurope);
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <h3 className="font-heading text-base font-semibold text-ink">🗓️ When to book — cheat sheet</h3>
      <p className="mt-1 text-xs text-muted">
        Rules of thumb for student travel. Every trip below also has its own booking links and a
        tailored timing tip.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-surface-muted p-3.5">
            <b className="block text-sm text-ink">{c.title}</b>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

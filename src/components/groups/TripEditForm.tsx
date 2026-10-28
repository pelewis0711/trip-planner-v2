"use client";
import { useState } from "react";
import { TRIPS } from "@/data/trips";
import type { GroupTrip, RoomSetup, TripChange } from "@/lib/social/groups";
import { ROOM_SIZES } from "@/lib/social/groups";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import { cardClass, inputClass, Switch } from "@/components/social/controls";
import { groupsChanged } from "./useGroupData";
export default function TripEditForm({
  trip,
  onDone,
}: {
  trip: GroupTrip;
  onDone: () => void;
}) {
  const [start, setStart] = useState(trip.start_date),
    [end, setEnd] = useState(trip.end_date),
    [stops, setStops] = useState(trip.stops),
    [rooms, setRooms] = useState<RoomSetup>({
      max_per_room: trip.max_per_room,
      couples_share_bed: trip.couples_share_bed,
      mixed_rooms: trip.mixed_rooms,
    });
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    const change: TripChange = {};
    if (start !== trip.start_date || end !== trip.end_date) {
      change.start_date = start;
      change.end_date = end;
    }
    if (JSON.stringify(stops) !== JSON.stringify(trip.stops))
      change.stops = stops;
    for (const key of [
      "max_per_room",
      "couples_share_bed",
      "mixed_rooms",
    ] as const) {
      if (rooms[key] !== trip[key])
        Object.assign(change, { [key]: rooms[key] });
    }
    if (!Object.keys(change).length) {
      setError("Change a date, destination or room preference first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await groupRpc(createClient(), "propose_trip_edit", {
        p_trip: trip.id,
        p_change: change,
      });
      groupsChanged();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not suggest edit.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={`${cardClass} space-y-3`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2 className="font-heading text-xl">Suggest an edit</h2>
      <p className="text-sm text-muted">
        Everyone Going can vote. These changes apply only after a majority
        approves.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Starts
          <input
            required
            className={inputClass}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Ends
          <input
            required
            className={inputClass}
            type="date"
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <h3 className="font-bold">Destinations, in order</h3>
      {stops.map((s, i) => (
        <div
          key={`${s.tripId}:${i}`}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="flex-1">
            {TRIPS.find((t) => t.id === s.tripId)?.n ?? s.tripId}
          </span>
          <label className="text-xs">
            Nights
            <input
              className={`${inputClass} max-w-20`}
              type="number"
              min={1}
              max={60}
              required
              value={s.nights}
              onChange={(e) =>
                setStops((rows) =>
                  rows.map((r, j) =>
                    j === i ? { ...r, nights: Number(e.target.value) } : r,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-md"
            aria-label={`Remove stop ${i + 1}`}
            onClick={() => setStops((rows) => rows.filter((_, j) => i !== j))}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <label className="flex-1 text-sm">
          Add destination
          <select
            className={inputClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">Choose a city</option>
            {TRIPS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.n}, {t.c}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!city || stops.length >= 20}
          className="btn btn-secondary btn-md self-end"
          onClick={() => {
            const t = TRIPS.find((t) => t.id === city);
            if (t)
              setStops((rows) => [
                ...rows,
                {
                  tripId: t.id,
                  nights: Math.min(60, Math.max(1, t.g)),
                  act: [],
                  sig: t.f.map(() => true),
                  l: 0,
                  fd: 0,
                },
              ]);
            setCity("");
          }}
        >
          Add
        </button>
      </div>
      <label className="block text-sm">
        Maximum people per room
        <select
          className={inputClass}
          value={rooms.max_per_room}
          onChange={(e) =>
            setRooms((r) => ({
              ...r,
              max_per_room: Number(e.target.value) as 2 | 3 | 4,
            }))
          }
        >
          {ROOM_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {(["couples_share_bed", "mixed_rooms"] as const).map((key) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="text-sm">
            {key === "couples_share_bed"
              ? "Couples share a bed"
              : "Mixed-gender rooms OK"}
          </span>
          <Switch
            label={
              key === "couples_share_bed"
                ? "Couples share a bed"
                : "Mixed-gender rooms OK"
            }
            checked={rooms[key]}
            onChange={(v) => setRooms((r) => ({ ...r, [key]: v }))}
          />
        </div>
      ))}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button disabled={busy} className="btn btn-primary btn-md">
          {busy ? "Sending…" : "Send suggestion"}
        </button>
        <button type="button" className="btn btn-ghost btn-md" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

"use client";
import { useState, useRef } from "react";
import { TRIPS } from "@/data/trips";
import {
  groupLodging,
  safeListingUrl,
  type GroupTrip,
} from "@/lib/social/groups";
import { formatMoney } from "@/lib/calc/currency";
import { usePlanStore } from "@/lib/store/plan";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import { cardClass, inputClass } from "@/components/social/controls";
import ChatPhoto from "@/components/social/ChatPhoto";
import { resizeChatPhoto } from "@/lib/social/messaging";
import { uploadChatPhoto } from "@/lib/supabase/messaging";
import { useAuthStore } from "@/lib/store/auth";
import { groupsChanged } from "./useGroupData";
export default function WeekendLodging({
  trip,
  onChange,
}: {
  trip: GroupTrip;
  onChange: () => void;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const currency = usePlanStore((s) => s.defaultCurrency);
  const n = trip.members.filter((m) => m.status === "going").length;
  const [url, setUrl] = useState(""),
    [title, setTitle] = useState(""),
    [price, setPrice] = useState(""),
    [unit, setUnit] = useState("EUR"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const addDays = (date: string, days: number) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const estimates = trip.stops.map((s, i) => {
    const offset = trip.stops
      .slice(0, i)
      .reduce((sum, stop) => sum + stop.nights, 0);
    const city = TRIPS.find((t) => t.id === s.tripId);
    const first = addDays(trip.start_date, offset);
    return {
      s,
      city,
      first,
      last: addDays(trip.start_date, offset + s.nights),
    };
  });
  async function save() {
    const safe = safeListingUrl(url);
    if (!safe) {
      setError(
        "Paste a full https:// listing link without a username or password.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const client = createClient();
    const expectedUser = useAuthStore.getState().user?.id;
    let path: string | undefined;
    try {
      if (photo)
        path = await uploadChatPhoto(
          client,
          trip.conversation_id,
          await resizeChatPhoto(photo),
        );
      await groupRpc(client, "add_lodging_listing", {
        p_trip: trip.id,
        p_url: safe,
        p_title: title,
        p_price: price ? Number(price) : null,
        p_currency: unit,
        p_photo: path ?? null,
        p_expected_user: expectedUser,
      });
      setPhoto(null);
      if (photoInput.current) photoInput.current.value = "";
      setUrl("");
      setTitle("");
      setPrice("");
      groupsChanged();
      onChange();
    } catch (e) {
      if (path) await client.storage.from("chat-photos").remove([path]);
      setError(e instanceof Error ? e.message : "Could not add listing.");
    } finally {
      setBusy(false);
    }
  }
  async function vote(id: string) {
    setBusy(true);
    setError("");
    try {
      await groupRpc(createClient(), "vote_lodging_listing", {
        p_trip: trip.id,
        p_listing: id,
      });
      groupsChanged();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not vote.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-2xl">
        Lodging for {n} {n === 1 ? "person" : "people"}
      </h2>
      <p className="text-sm text-muted">
        Estimates use your room capacity. Bed-sharing and mixed-room preferences
        still need checking with the property; no couples or genders are
        inferred.
      </p>
      {!n ? (
        <p className={cardClass}>Choose Going to see lodging estimates.</p>
      ) : !estimates.length ? (
        <p className={cardClass}>
          Suggest a destination to see estimates and booking links.
        </p>
      ) : (
        estimates.map(({ s, city, first, last }, i) =>
          city ? (
            <section key={i} className="space-y-2">
              <h3 className="font-bold">
                {city.n} · {s.nights} nights · {first}–{last}
              </h3>
              {last > trip.end_date && (
                <p className="text-sm text-warning">
                  These nights extend past your weekend dates. You can suggest a
                  date or nights change.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {groupLodging(
                  city.ci,
                  n,
                  trip.max_per_room,
                  city.n,
                  first,
                  last,
                  s.nights,
                ).map((l) => (
                  <article key={l.label} className={`${cardClass} space-y-2`}>
                    <h4 className="font-bold">{l.label}</h4>
                    <p className="text-xs text-muted">
                      {l.units} {l.unitLabel}
                    </p>
                    <p className="font-semibold">
                      Estimate {formatMoney(l.perPerson, currency)} / person
                    </p>
                    <p className="text-sm">
                      Estimate {formatMoney(l.total, currency)} total
                    </p>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-md"
                    >
                      Browse stays ↗
                    </a>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <p key={i}>This destination is no longer in the catalog.</p>
          ),
        )
      )}
      <section className={`${cardClass} space-y-3`}>
        <h3 className="font-heading text-xl">Lodging shortlist</h3>
        <p className="text-sm text-muted">
          Paste a listing to compare. Each person has one vote and can change
          it. Prices are entered by members, per night for the whole listing.
        </p>
        {trip.shortlist.map((l) => (
          <article
            key={l.id}
            className="flex flex-wrap items-center gap-3 border-b border-border py-3"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
              {l.thumbnail_path ? (
                <ChatPhoto path={l.thumbnail_path} />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-full items-center justify-center text-2xl"
                >
                  ⌂
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <a
                className="break-words font-bold underline"
                href={safeListingUrl(l.url) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                {l.title} ↗
              </a>
              <p className="text-xs text-muted">
                {l.nightly_price
                  ? `${l.currency} ${l.nightly_price} / night`
                  : "Price not supplied"}{" "}
                · {l.votes} votes
              </p>
            </div>
            <button
              disabled={busy}
              className={`btn btn-md ${l.my_vote ? "btn-primary" : "btn-secondary"}`}
              aria-pressed={l.my_vote}
              onClick={() => void vote(l.id)}
            >
              {l.my_vote ? "Your vote" : "Vote"}
            </button>
          </article>
        ))}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="block text-sm">
            Listing link
            <input
              required
              type="url"
              maxLength={2048}
              placeholder="https://…"
              className={inputClass}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Listing name
            <input
              required
              maxLength={100}
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              Nightly price (optional)
              <input
                type="number"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                className={inputClass}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Currency
              <select
                className={inputClass}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {["EUR", "USD", "GBP"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Listing photo (optional)
            <input
              ref={photoInput}
              className="mt-2 block min-h-11 w-full"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-xs text-muted">
            An attached photo is also shared in this weekend’s private chat.
            Listings without a photo use a placeholder.
          </p>
          <button disabled={busy} className="btn btn-primary btn-md">
            Add listing
          </button>
        </form>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </section>
    </section>
  );
}

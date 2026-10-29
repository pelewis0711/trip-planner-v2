"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import { useGroupData, groupsChanged } from "@/components/groups/useGroupData";
import {
  centsAmount,
  convertCents,
  money,
  toCents,
  SPLIT_CURRENCIES,
  type Expense,
  type SplitData,
} from "@/lib/social/split";
import { cardClass, inputClass, Segmented } from "@/components/social/controls";
import Avatar from "@/components/social/Avatar";
import ExpenseEditor from "@/components/split/ExpenseEditor";
import { RATES_AS_OF } from "@/lib/calc/currency";
const names = { USD: "US dollars", EUR: "Euros", GBP: "Pounds" };
export default function SplitPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user?.id);
  return <Split key={`${id}:${user}`} id={id} />;
}
function Split({ id }: { id: string }) {
  const user = useAuthStore((s) => s.user?.id);
  const { data, error, loaded, refresh } = useGroupData<SplitData>(
    "get_trip_split",
    { p_trip: id },
  );
  const [view, setView] = useState<"group" | "mine">("group"),
    [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  async function action(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setFailure("");
    try {
      await groupRpc(createClient(), name, args);
      groupsChanged();
      refresh();
    } catch (e) {
      setFailure(
        e instanceof Error ? e.message : "Could not update the balance sheet.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!loaded)
    return (
      <p className="p-6" role="status">
        Loading split…
      </p>
    );
  if (!data)
    return (
      <div className="mx-auto max-w-3xl p-5">
        <p role="alert">
          {error || "This balance sheet is not available to your account."}
        </p>
        <Link
          className="btn btn-secondary btn-md mt-4"
          href={`/weekends/${id}`}
        >
          Back to weekend
        </Link>
      </div>
    );
  const currency = view === "mine" ? data.my_currency : data.settle_currency;
  const display = (n: number) =>
    money(convertCents(n, data.settle_currency, currency), currency);
  const profile = (who: string) =>
    data.members.find((m) => m.user_id === who)?.profile;
  const name = (who: string) =>
    who === user
      ? "You"
      : (profile(who)?.display_name ?? "Former or private member");
  const owed = data.balances.find((b) => b.user_id === user)?.cents ?? 0;
  const total = data.expenses.reduce(
    (s, e) =>
      s + convertCents(toCents(e.amount), e.currency, data.settle_currency),
    0,
  );
  const going = data.members.filter((m) => m.status === "going").length;
  const participants = new Set(
    data.expenses.flatMap((e) =>
      e.shares.filter((s) => Number(s.amount) > 0).map((s) => s.user_id),
    ),
  ).size;
  const pairLabel = (from: string, to: string) =>
    from === user
      ? `You owe ${name(to)}`
      : to === user
        ? `${name(from)} owes you`
        : `${name(from)} owes ${name(to)}`;
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-28">
      <Link
        className="inline-flex min-h-11 items-center text-sm underline"
        href={`/weekends/${id}`}
      >
        ← {data.title}
      </Link>
      <h1 className="font-heading text-3xl">Split costs</h1>
      <section className="rounded-card bg-primary p-6 text-white">
        <p className="font-heading text-3xl">
          {owed > 0
            ? `You are owed ${display(owed)}`
            : owed < 0
              ? `You owe ${display(-owed)}`
              : "All settled up"}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <p>Trip total {display(total)}</p>
          <p>
            Average per cost participant{" "}
            {display(participants ? Math.round(total / participants) : 0)}
          </p>
          <p>{going} people Going</p>
        </div>
      </section>
      <Segmented
        label="Display currency"
        value={view}
        onChange={setView}
        options={[
          { value: "group", label: `${names[data.settle_currency]} (group)` },
          { value: "mine", label: `My currency (${data.my_currency})` },
        ]}
      />
      <p className="text-sm text-muted">
        Costs split evenly by default. Paying each other back happens outside
        WhereNext; this is a balance sheet only. Settlements are always recorded
        in {data.settle_currency}. Currency conversions use approximate rates (
        {RATES_AS_OF}); displayed conversions are rounded separately.
      </p>
      {!data.expenses.length && !data.settlements.length && (
        <label className="block text-sm">
          Group currency (locked after the first cost)
          <select
            className={inputClass}
            disabled={busy}
            value={data.settle_currency}
            onChange={(e) =>
              void action("set_split_currency", {
                p_trip: id,
                p_currency: e.target.value,
              })
            }
          >
            {SPLIT_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {names[c]}
              </option>
            ))}
          </select>
        </label>
      )}
      {failure && (
        <p role="alert" className="text-danger">
          {failure}
        </p>
      )}
      <section className={`${cardClass} space-y-3`}>
        <h2 className="font-heading text-2xl">Who pays whom</h2>
        {!data.transfers.length && (
          <p className="text-muted">No repayments are needed.</p>
        )}
        {data.transfers.map((t) => {
          const other = t.from_user === user ? t.to_user : t.from_user;
          return (
            <div
              key={`${t.from_user}:${t.to_user}`}
              className="flex flex-wrap items-center gap-3 border-b border-border py-3"
            >
              <Avatar
                size={40}
                name={name(other)}
                path={profile(other)?.avatar_path}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {pairLabel(t.from_user, t.to_user)}
                </p>
                <p>{display(t.cents)}</p>
                {currency !== data.settle_currency && (
                  <p className="text-xs text-muted">
                    Record {money(t.cents, data.settle_currency)} settled
                  </p>
                )}
              </div>
              {[t.from_user, t.to_user].includes(user ?? "") && (
                <button
                  className="btn btn-secondary btn-md"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Confirm ${money(t.cents, data.settle_currency)} was paid back outside WhereNext?`,
                      )
                    )
                      void action("mark_trip_settled", {
                        p_trip: id,
                        p_from: t.from_user,
                        p_to: t.to_user,
                        p_amount: centsAmount(t.cents),
                      });
                  }}
                >
                  Mark settled
                </button>
              )}
            </div>
          );
        })}
      </section>
      {data.settlements.length > 0 && (
        <section className={`${cardClass} space-y-3`}>
          <h2 className="font-heading text-2xl">Recorded repayments</h2>
          {data.settlements.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
            >
              <p>
                {name(s.from_user)} → {name(s.to_user)} ·{" "}
                {money(toCents(s.amount), s.currency)} ·{" "}
                {s.undone_at ? "Undone" : "Settled"}
              </p>
              {!s.undone_at &&
                [s.from_user, s.to_user].includes(user ?? "") && (
                  <button
                    className="btn btn-secondary btn-md"
                    disabled={busy}
                    onClick={() =>
                      void action("undo_trip_settlement", {
                        p_settlement: s.id,
                      })
                    }
                  >
                    Undo
                  </button>
                )}
            </div>
          ))}
        </section>
      )}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-2xl">Costs</h2>
          <button
            className="btn btn-primary btn-md"
            disabled={busy}
            onClick={() => setEditing("new")}
          >
            + Add a cost
          </button>
        </div>
        {!data.expenses.length && (
          <p className={cardClass}>
            Add your first shared cost, such as a stay, dinner or train tickets.
          </p>
        )}
        {data.expenses.map((e) => {
          const shares = e.shares.filter((s) => Number(s.amount) > 0);
          const same =
            shares.length > 0 &&
            shares.every((s) => Number(s.amount) === Number(shares[0].amount));
          const own = e.created_by === user || e.paid_by === user;
          return (
            <article key={e.id} className={`${cardClass} space-y-2`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{e.description}</h3>
                  <p className="text-sm text-muted">
                    Paid by {name(e.paid_by)} · split {shares.length} ways
                  </p>
                </div>
                <p className="font-semibold">
                  {money(toCents(e.amount), e.currency)}
                </p>
              </div>
              <p className="text-sm">
                {same
                  ? `${money(toCents(shares[0].amount), e.currency)} each`
                  : "Individual shares (including rounding):"}
              </p>
              {!same && (
                <ul className="space-y-1 text-sm text-muted">
                  {shares.map((s) => (
                    <li key={s.user_id}>
                      {name(s.user_id)} · {money(toCents(s.amount), e.currency)}
                    </li>
                  ))}
                </ul>
              )}
              {e.currency !== currency && (
                <p className="text-xs text-muted">
                  {money(
                    convertCents(toCents(e.amount), e.currency, currency),
                    currency,
                  )}{" "}
                  converted at approximate rates
                </p>
              )}
              {own && (
                <button
                  className="btn btn-ghost btn-md"
                  onClick={() => setEditing(e)}
                >
                  Edit cost
                </button>
              )}
            </article>
          );
        })}
      </section>
      <p className="text-xs text-muted">
        Leaving a trip or changing an RSVP keeps existing shares. If an account
        is deleted, shared accounting entries remain without its profile so
        everyone else’s balances stay correct.
      </p>
      {editing && (
        <ExpenseEditor
          data={data}
          expense={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            groupsChanged();
            refresh();
          }}
        />
      )}
    </main>
  );
}

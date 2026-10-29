"use client";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import {
  centsAmount,
  evenShares,
  money,
  toCents,
  SPLIT_CURRENCIES,
  type Expense,
  type SplitData,
} from "@/lib/social/split";
import type { Currency } from "@/components/onboarding/OnboardingFlow";
import { inputClass, Segmented } from "@/components/social/controls";
export default function ExpenseEditor({
  data,
  expense,
  onClose,
  onSaved,
}: {
  data: SplitData;
  expense?: Expense;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const user = useAuthStore((s) => s.user?.id);
  const [request] = useState(() => crypto.randomUUID());
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(
    expense ? centsAmount(toCents(expense.amount)) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    expense?.currency ?? data.settle_currency,
  );
  const [payer, setPayer] = useState(expense?.paid_by ?? user ?? "");
  const [mode, setMode] = useState<"even" | "custom">(
    expense ? "custom" : "even",
  );
  const [selected, setSelected] = useState(
    expense
      ? expense.shares.map((s) => s.user_id)
      : data.members.filter((m) => m.status === "going").map((m) => m.user_id),
  );
  const [custom, setCustom] = useState<Record<string, string>>(
    Object.fromEntries(
      expense?.shares.map((s) => [s.user_id, centsAmount(toCents(s.amount))]) ??
        [],
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const people = data.members.filter(
    (m) =>
      m.status !== null ||
      expense?.shares.some((s) => s.user_id === m.user_id) ||
      expense?.paid_by === m.user_id,
  );
  const name = (id: string) =>
    data.members.find((m) => m.user_id === id)?.profile?.display_name ??
    "Former or private member";
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  let shares: Record<string, number> = {},
    problem = "";
  try {
    const cents = toCents(amount);
    if (!cents || cents >= 1_000_000_000_000)
      throw new Error("Enter a cost between 0.01 and 9,999,999,999.99.");
    shares =
      mode === "even"
        ? evenShares(cents, selected, payer)
        : Object.fromEntries(
            selected.map((id) => [id, toCents(custom[id] || "0")]),
          );
    if (!selected.length || selected.length > (mode === "custom" ? 11 : 10))
      throw new Error(
        "Choose up to ten people; custom shares can also retain a former payer.",
      );
    if (Object.values(shares).reduce((s, n) => s + n, 0) !== cents)
      throw new Error("The shares must add up exactly to the cost.");
  } catch (e) {
    problem = e instanceof Error ? e.message : "Check the amounts.";
  }
  function changeMode(next: "even" | "custom") {
    if (next === "custom" && mode === "even") {
      setSelected(Object.keys(shares));
      setCustom(
        Object.fromEntries(
          Object.entries(shares).map(([id, n]) => [id, centsAmount(n)]),
        ),
      );
    }
    setMode(next);
  }
  async function save() {
    setError("");
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await groupRpc(createClient(), "save_trip_expense", {
        p_trip: data.id,
        p_description: description,
        p_amount: amount,
        p_currency: currency,
        p_paid_by: payer,
        p_users: mode === "even" ? selected : null,
        p_shares:
          mode === "custom"
            ? Object.entries(shares).map(([user_id, n]) => ({
                user_id,
                amount: Number(centsAmount(n)),
              }))
            : null,
        p_expense: expense?.id ?? null,
        p_version: expense?.version ?? null,
        p_request: request,
        p_expected_user: user,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this cost.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !expense ||
      !window.confirm("Delete this cost? Balances will be recalculated.")
    )
      return;
    setBusy(true);
    setError("");
    try {
      await groupRpc(createClient(), "delete_trip_expense", {
        p_expense: expense.id,
        p_version: expense.version,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="expense-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 text-ink backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-xl sm:rounded-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="expense-title" className="font-heading text-2xl">
          {expense ? "Edit cost" : "Add a cost"}
        </h2>
        <button
          type="button"
          disabled={busy}
          className="btn btn-ghost btn-md"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="block text-sm">
          Description
          <input
            autoFocus
            required
            maxLength={80}
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Amount
            <input
              required
              inputMode="decimal"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="text-sm">
            Currency
            <select
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {SPLIT_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Paid by
          <select
            className={inputClass}
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          >
            {people.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.user_id === user ? "You" : name(m.user_id)}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="How to split"
          value={mode}
          onChange={changeMode}
          options={[
            { value: "even", label: "Split evenly" },
            { value: "custom", label: "Custom amounts" },
          ]}
        />
        <fieldset>
          <legend className="mb-2 font-bold">Who is in this cost?</legend>
          <p className="mb-2 text-xs text-muted">
            Changing an RSVP later will not change these shares. Any leftover
            cents from an even split go to the payer, including when they are
            not selected.
          </p>
          {people.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between gap-3 border-b border-border py-1"
            >
              <label className="flex min-h-11 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  checked={selected.includes(m.user_id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, m.user_id]
                        : s.filter((id) => id !== m.user_id),
                    )
                  }
                />
                <span>
                  {m.user_id === user ? "You" : name(m.user_id)}
                  {m.status === null ? " · left trip" : ""}
                </span>
              </label>
              {mode === "custom" && selected.includes(m.user_id) ? (
                <label className="w-32">
                  <span className="sr-only">
                    Share for {name(m.user_id)} in {currency}
                  </span>
                  <input
                    inputMode="decimal"
                    className={inputClass}
                    value={custom[m.user_id] ?? ""}
                    placeholder="0.00"
                    onChange={(e) =>
                      setCustom((s) => ({ ...s, [m.user_id]: e.target.value }))
                    }
                  />
                </label>
              ) : (
                <span className="text-sm">
                  {shares[m.user_id] !== undefined
                    ? money(shares[m.user_id], currency)
                    : ""}
                </span>
              )}
            </div>
          ))}
        </fieldset>
        {mode === "custom" && (
          <p className="text-sm">
            Shares total{" "}
            {money(
              Object.values(shares).reduce((s, n) => s + n, 0),
              currency,
            )}
            . They must equal the cost.
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <p className="text-xs text-muted">
          Edits and deletions recalculate balances; previously recorded
          repayments stay until someone involved undoes them.
        </p>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className="btn btn-primary btn-md">
            {busy ? "Saving…" : "Save cost"}
          </button>
          {expense && (
            <button
              type="button"
              disabled={busy}
              className="btn btn-ghost btn-md text-danger"
              onClick={() => void remove()}
            >
              Delete cost
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

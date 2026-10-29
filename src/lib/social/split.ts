import { RATES } from "@/lib/calc/currency";
import type { Currency } from "@/components/onboarding/OnboardingFlow";
import type { ProfileView } from "./profile";
export const SPLIT_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export interface Share {
  user_id: string;
  amount: number;
}
export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  paid_by: string;
  created_by: string | null;
  version: number;
  shares: Share[];
}
export interface Settlement {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  currency: Currency;
  undone_at: string | null;
}
export interface Balance {
  user_id: string;
  cents: number;
}
export interface Transfer {
  from_user: string;
  to_user: string;
  cents: number;
}
export interface SplitData {
  id: string;
  title: string;
  settle_currency: Currency;
  my_currency: Currency;
  members: {
    user_id: string;
    profile: ProfileView | null;
    status: "going" | "maybe" | "out" | null;
  }[];
  expenses: Expense[];
  settlements: Settlement[];
  balances: Balance[];
  transfers: Transfer[];
}
export function toCents(value: string | number): number {
  const s = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("Enter an amount with at most two decimal places.");
  const [whole, part = ""] = s.split(".");
  const n = BigInt(whole) * BigInt(100) + BigInt(part.padEnd(2, "0"));
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Amount is too large.");
  return Number(n);
}
export function centsAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Invalid cents");
  const n = BigInt(Math.abs(cents));
  return `${cents < 0 ? "-" : ""}${n / BigInt(100)}.${String(n % BigInt(100)).padStart(2, "0")}`;
}
export function convertCents(cents: number, from: Currency, to: Currency) {
  const a = BigInt(Math.round(RATES[from] * 100)),
    b = BigInt(Math.round(RATES[to] * 100));
  const result =
    (BigInt(Math.abs(cents)) * b * BigInt(2) + a) / (a * BigInt(2));
  const n = Number(result) * (cents < 0 ? -1 : 1);
  if (!Number.isSafeInteger(n)) throw new Error("Amount is too large.");
  return n;
}
export function money(cents: number, currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
export function evenShares(
  cents: number,
  users: string[],
  payer: string,
): Record<string, number> {
  if (
    !Number.isSafeInteger(cents) ||
    cents <= 0 ||
    !users.length ||
    users.length > 10 ||
    new Set(users).size !== users.length
  )
    throw new Error("Choose 1–10 people and a positive amount.");
  const each = Math.floor(cents / users.length),
    result = Object.fromEntries(users.map((id) => [id, each]));
  const remainder = cents - each * users.length;
  if (remainder) result[payer] = (result[payer] ?? 0) + remainder;
  return result;
}
export function netBalances(
  expenses: Expense[],
  settlements: Settlement[],
  currency: Currency,
): Balance[] {
  const result = new Map<string, number>();
  const add = (id: string, n: number) =>
    result.set(id, (result.get(id) ?? 0) + n);
  for (const e of expenses) {
    const original = toCents(e.amount),
      total = convertCents(original, e.currency, currency);
    if (e.shares.reduce((s, x) => s + toCents(x.amount), 0) !== original)
      throw new Error("Shares must equal the cost.");
    add(e.paid_by, total);
    let allocated = 0;
    for (const share of e.shares) {
      const owed = Number(
        (BigInt(total) * BigInt(toCents(share.amount))) / BigInt(original),
      );
      add(share.user_id, -owed);
      allocated += owed;
    }
    add(e.paid_by, -(total - allocated));
  }
  for (const s of settlements) {
    if (s.undone_at) continue;
    if (s.currency !== currency)
      throw new Error("Settlement currency must match the trip.");
    const cents = toCents(s.amount);
    add(s.from_user, cents);
    add(s.to_user, -cents);
  }
  return [...result].map(([user_id, cents]) => ({ user_id, cents }));
}
/** Largest debtor pays largest creditor; lexical IDs break ties deterministically. */
export function whoPaysWhom(balances: Balance[]): Transfer[] {
  const work = balances.map((x) => ({ ...x })),
    result: Transfer[] = [];
  if (
    work.some((x) => !Number.isSafeInteger(x.cents)) ||
    work.reduce((s, x) => s + x.cents, 0) !== 0
  )
    throw new Error("Balances must sum to zero.");
  for (;;) {
    const debtor = work
      .filter((x) => x.cents < 0)
      .sort(
        (a, b) => a.cents - b.cents || a.user_id.localeCompare(b.user_id),
      )[0];
    const creditor = work
      .filter((x) => x.cents > 0)
      .sort(
        (a, b) => b.cents - a.cents || a.user_id.localeCompare(b.user_id),
      )[0];
    if (!debtor || !creditor) break;
    const cents = Math.min(-debtor.cents, creditor.cents);
    result.push({
      from_user: debtor.user_id,
      to_user: creditor.user_id,
      cents,
    });
    debtor.cents += cents;
    creditor.cents -= cents;
  }
  return result;
}

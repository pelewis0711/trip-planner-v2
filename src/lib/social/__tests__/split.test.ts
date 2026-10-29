import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RATES } from "@/lib/calc/currency";
import {
  evenShares,
  toCents,
  centsAmount,
  convertCents,
  netBalances,
  whoPaysWhom,
  SPLIT_CURRENCIES,
  type Expense,
  type Settlement,
} from "../split";
const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "e",
  description: "Dinner",
  amount: 100,
  currency: "EUR",
  paid_by: "a",
  created_by: "a",
  version: 1,
  shares: [
    { user_id: "a", amount: 33.34 },
    { user_id: "b", amount: 33.33 },
    { user_id: "c", amount: 33.33 },
  ],
  ...overrides,
});
describe("exact-cent splitting", () => {
  it("puts €100 / 3 remainder on the payer", () =>
    expect(evenShares(10000, ["a", "b", "c"], "a")).toEqual({
      a: 3334,
      b: 3333,
      c: 3333,
    }));
  it("assigns remainder to a payer outside the selected participants", () =>
    expect(evenShares(10000, ["b", "c", "d"], "a")).toEqual({
      b: 3333,
      c: 3333,
      d: 3333,
      a: 1,
    }));
  it.each(Array.from({ length: 10 }, (_, i) => i + 1))(
    "conserves every cent for %i people including tiny amounts",
    (n) => {
      const ids = Array.from({ length: n }, (_, i) => String(i));
      for (const cents of [1, 2, 7, 99, 100, 10000, 999999999999]) {
        const shares = evenShares(cents, ids, "0");
        expect(Object.values(shares).reduce((s, x) => s + x, 0)).toBe(cents);
        expect(Object.values(shares).every(Number.isInteger)).toBe(true);
      }
    },
  );
  it("rejects empty/duplicate people, negative costs and fractional cents", () => {
    expect(() => evenShares(100, [], "a")).toThrow();
    expect(() => evenShares(100, ["a", "a"], "a")).toThrow();
    for (const raw of ["1.001", "-1", "NaN", "1e4", "Infinity", ""])
      expect(() => toCents(raw)).toThrow();
    expect(() => evenShares(-1, ["a"], "a")).toThrow();
  });
  it("parses decimal strings exactly and round trips large amounts", () => {
    expect(toCents("0.29")).toBe(29);
    expect(toCents("12.3")).toBe(1230);
    expect(centsAmount(999999999999)).toBe("9999999999.99");
    expect(toCents(centsAmount(999999999999))).toBe(999999999999);
  });
  it("converts using existing approximate rates with symmetric cent rounding", () => {
    expect(convertCents(10000, "USD", "EUR")).toBe(9200);
    expect(convertCents(9200, "EUR", "GBP")).toBe(7900);
    expect(convertCents(-1, "GBP", "USD")).toBe(-1);
    expect(convertCents(29, "EUR", "EUR")).toBe(29);
  });
  it("supports uneven custom shares and preserves zero sum across all currencies", () => {
    const e = expense({
      amount: 15.01,
      shares: [
        { user_id: "a", amount: 2 },
        { user_id: "b", amount: 13.01 },
      ],
    });
    for (const curr of SPLIT_CURRENCIES) {
      const b = netBalances([e], [], curr);
      expect(b.reduce((s, x) => s + x.cents, 0)).toBe(0);
      expect(whoPaysWhom(b)).toHaveLength(1);
    }
  });
  it("preserves recorded participants independently of current RSVP", () => {
    const balances = netBalances([expense()], [], "EUR");
    expect(balances.find((b) => b.user_id === "c")?.cents).toBe(-3333);
  });
  it("payments reduce debt/credit and undo restores them", () => {
    const payment: Settlement = {
      id: "s",
      from_user: "b",
      to_user: "a",
      amount: 33.33,
      currency: "EUR",
      undone_at: null,
    };
    const b = netBalances([expense()], [payment], "EUR");
    expect(b.find((x) => x.user_id === "b")?.cents).toBe(0);
    expect(b.reduce((s, x) => s + x.cents, 0)).toBe(0);
    expect(
      netBalances([expense()], [{ ...payment, undone_at: "now" }], "EUR"),
    ).toEqual(netBalances([expense()], [], "EUR"));
  });
  it("greedily matches largest debtor/creditor and fully settles every balance", () => {
    const b = [
      { user_id: "a", cents: 7000 },
      { user_id: "b", cents: -6000 },
      { user_id: "c", cents: 3000 },
      { user_id: "d", cents: -4000 },
    ];
    const t = whoPaysWhom(b);
    expect(t).toEqual([
      { from_user: "b", to_user: "a", cents: 6000 },
      { from_user: "d", to_user: "c", cents: 3000 },
      { from_user: "d", to_user: "a", cents: 1000 },
    ]);
    for (const x of t) {
      b.find((p) => p.user_id === x.from_user)!.cents += x.cents;
      b.find((p) => p.user_id === x.to_user)!.cents -= x.cents;
    }
    expect(b.every((x) => x.cents === 0)).toBe(true);
  });
  it("breaks ties deterministically and rejects non-zero-sum input", () => {
    expect(
      whoPaysWhom([
        { user_id: "c", cents: -1 },
        { user_id: "b", cents: -1 },
        { user_id: "a", cents: 2 },
      ])[0].from_user,
    ).toBe("b");
    expect(() => whoPaysWhom([{ user_id: "a", cents: 1 }])).toThrow();
  });
  it("conserves mixed-currency large ledgers through settlements", () => {
    const expenses = Array.from({ length: 100 }, (_, i) =>
      expense({
        id: String(i),
        amount: 9999999999.99,
        currency: SPLIT_CURRENCIES[i % 3],
        shares: [
          { user_id: "a", amount: 3333333333.33 },
          { user_id: "b", amount: 6666666666.66 },
        ],
      }),
    );
    const b = netBalances(expenses, [], "USD");
    expect(b.reduce((s, x) => s + x.cents, 0)).toBe(0);
    expect(b.every((x) => Number.isSafeInteger(x.cents))).toBe(true);
  });
  it("rejects mismatched shares and settlement currencies", () => {
    expect(() =>
      netBalances(
        [expense({ shares: [{ user_id: "a", amount: 1 }] })],
        [],
        "EUR",
      ),
    ).toThrow();
    expect(() =>
      netBalances(
        [],
        [
          {
            id: "s",
            from_user: "b",
            to_user: "a",
            amount: 1,
            currency: "GBP",
            undone_at: null,
          },
        ],
        "EUR",
      ),
    ).toThrow();
  });
  it("keeps SQL currencies/rates and TypeScript in sync", () => {
    const sql = readFileSync("supabase/migrations/0018_split.sql", "utf8");
    for (const c of SPLIT_CURRENCIES) {
      expect(sql).toContain(`when '${c}' then ${Math.round(RATES[c] * 100)}`);
      expect(sql).toContain("('USD','EUR','GBP')");
    }
  });
});

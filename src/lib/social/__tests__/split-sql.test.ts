import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { socialDatabase, asUser } from "./database";
import { netBalances, whoPaysWhom, type SplitData } from "../split";
let db: PGlite;
const [a, b, c, d] = [1, 2, 3, 4].map(
  (n) => `30000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
);
const q = (u: string, s: string) => asUser(db, u, s);
async function val<T = string>(u: string, s: string): Promise<T> {
  return Object.values((await q(u, s)).rows[0] ?? {})[0] as T;
}
async function setup() {
  const gid = await val(a, "select create_group('Costs')");
  await q(a, `select add_group_friend('${gid}','${b}')`);
  await q(a, `select add_group_friend('${gid}','${c}')`);
  return {
    gid,
    tid: await val(
      a,
      `select create_group_trip('Rome','2027-03-05','2027-03-07','${gid}')`,
    ),
  };
}
const cost = (tid: string, u = a, amount = 100, currency = "EUR") =>
  val(
    u,
    `select save_trip_expense('${tid}','Dinner',${amount},'${currency}','${a}')`,
  );
const sheet = (tid: string, u = a) =>
  val<SplitData>(u, `select get_trip_split('${tid}')`);
beforeAll(async () => {
  db = await socialDatabase();
  await db.exec(readFileSync("supabase/migrations/0018_split.sql", "utf8"));
  for (const [i, id] of [a, b, c, d].entries())
    await db.exec(
      `insert into auth.users(id,email) values('${id}','split${i}@illinois.edu');insert into public_profiles(id,username,display_name,adult_confirmed_at) values('${id}','split${i}','Split ${i}',now());insert into social_settings(id,discoverable) values('${id}',true);`,
    );
  for (const id of [b, c, d]) {
    await q(a, `select request_friend('${id}')`);
    await q(id, `select respond_friend('${a}','accept')`);
  }
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("defaults to current Going and puts remainder cents on the payer", async () => {
  const { tid } = await setup();
  await cost(tid);
  const s = await sheet(tid);
  expect(s.expenses[0].shares.map((x) => Number(x.amount)).sort()).toEqual([
    33.33, 33.33, 33.34,
  ]);
  expect(s.balances.reduce((n, x) => n + x.cents, 0)).toBe(0);
  expect(s.transfers).toEqual(
    whoPaysWhom(netBalances(s.expenses, s.settlements, s.settle_currency)),
  );
  await q(b, `select set_trip_rsvp('${tid}','out')`);
  expect((await sheet(tid)).expenses[0].shares).toEqual(s.expenses[0].shares);
  await cost(tid, a, 10);
  expect((await sheet(tid)).expenses[0].shares).toHaveLength(2);
});
it("allows every RSVP to add costs but only payer/creator to edit or delete", async () => {
  const { tid } = await setup();
  await q(b, `select set_trip_rsvp('${tid}','maybe')`);
  const eid = await cost(tid, b);
  await expect(
    q(
      c,
      `select save_trip_expense('${tid}','Wrong',100,'EUR','${a}',null,null,'${eid}',1)`,
    ),
  ).rejects.toThrow("WN_COST_OWNER_REQUIRED");
  await expect(q(c, `select delete_trip_expense('${eid}',1)`)).rejects.toThrow(
    "WN_COST_OWNER_REQUIRED",
  );
  await q(
    a,
    `select save_trip_expense('${tid}','Changed',120,'EUR','${a}',null,null,'${eid}',1)`,
  );
  await expect(q(b, `select delete_trip_expense('${eid}',1)`)).rejects.toThrow(
    "WN_COST_CHANGED",
  );
  await q(b, `select delete_trip_expense('${eid}',2)`);
  expect((await sheet(tid)).expenses).toEqual([]);
});
it("accepts exact custom shares and rejects invalid sums/people/decimal precision", async () => {
  const { tid } = await setup();
  const shares = JSON.stringify([
    { user_id: a, amount: 12.34 },
    { user_id: b, amount: 87.66 },
  ]);
  await q(
    a,
    `select save_trip_expense('${tid}','Custom',100,'EUR','${a}',null,'${shares}')`,
  );
  expect((await sheet(tid)).expenses[0].shares).toHaveLength(2);
  await expect(
    q(
      a,
      `select save_trip_expense('${tid}','Bad',100,'EUR','${a}',null,'[{"user_id":"${b}","amount":99}]')`,
    ),
  ).rejects.toThrow("WN_SHARE_SUM");
  await expect(
    q(
      a,
      `select save_trip_expense('${tid}','Bad',100,'EUR','${a}',array['${d}']::uuid[])`,
    ),
  ).rejects.toThrow("WN_COST_MEMBER_REQUIRED");
  await expect(cost(tid, a, 1.001)).rejects.toThrow("WN_INVALID_COST");
  await expect(cost(tid, a, -1)).rejects.toThrow("WN_INVALID_COST");
});
it("enforces sums at transaction commit even for privileged direct SQL", async () => {
  const { tid } = await setup();
  const eid = await cost(tid);
  await db.exec("reset role");
  await expect(
    db.exec(
      `update expense_shares set amount=amount+0.01 where expense_id='${eid}' and user_id='${b}'`,
    ),
  ).rejects.toThrow("WN_SHARE_SUM");
  expect((await sheet(tid)).expenses[0].amount).toBe(100);
});
it("settles and undoes from either party, rejects outsiders and stale double clicks", async () => {
  const { tid } = await setup();
  await cost(tid);
  const s = await sheet(tid),
    t = s.transfers[0];
  await expect(
    q(
      c,
      `select mark_trip_settled('${tid}','${t.from_user}','${t.to_user}',${t.cents / 100})`,
    ),
  ).rejects.toThrow("WN_SETTLEMENT_PARTY_REQUIRED");
  const sid = await val(
    b,
    `select mark_trip_settled('${tid}','${t.from_user}','${t.to_user}',${t.cents / 100})`,
  );
  await expect(
    q(
      b,
      `select mark_trip_settled('${tid}','${t.from_user}','${t.to_user}',${t.cents / 100})`,
    ),
  ).rejects.toThrow("WN_BALANCE_CHANGED");
  expect((await sheet(tid)).balances.find((x) => x.user_id === b)?.cents).toBe(
    0,
  );
  await q(a, `select undo_trip_settlement('${sid}')`);
  expect((await sheet(tid)).transfers).toEqual(s.transfers);
  await q(b, `select undo_trip_settlement('${sid}')`);
  expect((await sheet(tid)).transfers).toEqual(s.transfers);
});
it("uses exact static rates, locks group currency once costs exist and matches TypeScript", async () => {
  const { tid } = await setup();
  await q(b, `select set_split_currency('${tid}','GBP')`);
  await cost(tid, a, 100, "USD");
  await cost(tid, a, 15.01, "EUR");
  const s = await sheet(tid);
  expect(s.transfers).toEqual(
    whoPaysWhom(netBalances(s.expenses, s.settlements, s.settle_currency)),
  );
  expect(s.balances.reduce((n, x) => n + x.cents, 0)).toBe(0);
  await expect(
    q(a, `select set_split_currency('${tid}','EUR')`),
  ).rejects.toThrow("WN_CURRENCY_LOCKED");
});
it("retains old shares when leaving, denies former members and outsiders", async () => {
  const { gid, tid } = await setup();
  await cost(tid);
  await q(b, `select group_member_action('${gid}','${b}','leave')`);
  expect((await sheet(tid)).expenses[0].shares).toHaveLength(3);
  expect(await sheet(tid, b)).toBeNull();
  expect(await sheet(tid, d)).toBeNull();
  await expect(cost(tid, d)).rejects.toThrow("WN_TRIP_UNAVAILABLE");
});
it("rejects stale account writes and deduplicates retried additions/system notices", async () => {
  const { tid } = await setup();
  const key = "30000000-0000-0000-0000-999999999999";
  const sql = `select save_trip_expense('${tid}','Retry',10,'EUR','${a}',null,null,null,null,'${key}','${a}')`;
  const id = await val(a, sql);
  expect(await val(a, sql)).toBe(id);
  await expect(val(b, sql)).rejects.toThrow("WN_AUTH_REQUIRED");
  expect((await sheet(tid)).expenses).toHaveLength(1);
  await db.exec("reset role");
  const notices = await db.query(
    `select id from messages where payload->>'expense_id'='${id}' and payload->>'event'='cost_added'`,
  );
  expect(notices.rows).toHaveLength(1);
});
it("denies raw table access, anonymous RPCs, private helpers and blocked members", async () => {
  const { tid } = await setup();
  await expect(q(a, "select * from trip_expenses")).rejects.toThrow(
    "permission denied",
  );
  await expect(
    q(a, `select * from wn_split_balances('${tid}')`),
  ).rejects.toThrow("permission denied");
  await db.exec("reset role;set role anon");
  await expect(db.query(`select get_trip_split('${tid}')`)).rejects.toThrow(
    "permission denied",
  );
  await q(a, `select block_person('${b}')`);
  expect(await sheet(tid, b)).toBeNull();
  await q(a, `select unblock_person('${b}')`);
  await q(a, `select request_friend('${b}')`);
  await q(b, `select respond_friend('${a}','accept')`);
});
it("keeps a non-Going payer's remainder and enforces expense totals too", async () => {
  const { tid } = await setup();
  await q(a, `select set_trip_rsvp('${tid}','out')`);
  const eid = await cost(tid, a, 10.01);
  const e = (await sheet(tid)).expenses[0];
  expect(e.shares.find((x) => x.user_id === a)?.amount).toBe(0.01);
  expect(e.shares.filter((x) => x.user_id !== a).map((x) => x.amount)).toEqual([
    5, 5,
  ]);
  await db.exec("reset role");
  await expect(
    db.exec(`update trip_expenses set amount=11 where id='${eid}'`),
  ).rejects.toThrow("WN_SHARE_SUM");
  expect((await sheet(tid)).expenses[0].amount).toBe(10.01);
});
it("edits selected people and custom shares without accepting unrelated payers", async () => {
  const { tid } = await setup();
  const eid = await cost(tid);
  await q(
    a,
    `select save_trip_expense('${tid}','Two people',100,'EUR','${a}',array['${a}','${b}']::uuid[],null,'${eid}',1)`,
  );
  expect((await sheet(tid)).expenses[0].shares.map((x) => x.amount)).toEqual([
    50, 50,
  ]);
  await expect(
    q(
      a,
      `select save_trip_expense('${tid}','Wrong payer',100,'EUR','${d}',null,null,'${eid}',2)`,
    ),
  ).rejects.toThrow("WN_COST_MEMBER_REQUIRED");
  await q(
    a,
    `select save_trip_expense('${tid}','Custom',100,'EUR','${a}',null,'[{"user_id":"${a}","amount":12.34},{"user_id":"${b}","amount":87.66}]','${eid}',2)`,
  );
  expect(
    (await sheet(tid)).expenses[0].shares.map((x) => x.amount).sort(),
  ).toEqual([12.34, 87.66]);
});
it("keeps anonymous ledger totals after account deletion and does not open owner permissions", async () => {
  const { gid, tid } = await setup();
  await q(a, `select add_group_friend('${gid}','${d}')`);
  await cost(tid, d);
  await db.exec(`reset role;delete from auth.users where id='${d}'`);
  const s = await sheet(tid);
  expect(s.expenses[0].created_by).toBeNull();
  expect(s.balances.reduce((n, x) => n + x.cents, 0)).toBe(0);
  await expect(
    q(b, `select delete_trip_expense('${s.expenses[0].id}',1)`),
  ).rejects.toThrow("WN_COST_OWNER_REQUIRED");
  expect(s.members.find((x) => x.user_id === d)?.profile).toBeNull();
});

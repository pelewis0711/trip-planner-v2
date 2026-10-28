import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { socialDatabase, asUser } from "./database";
let db: PGlite;
const ids = Array.from(
  { length: 14 },
  (_, i) => `29000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
);
const [a, b, c, d] = ids;
const q = (user: string, sql: string) => asUser(db, user, sql);
async function value<T = string>(user: string, sql: string): Promise<T> {
  return Object.values((await q(user, sql)).rows[0] ?? {})[0] as T;
}
const group = () => value(a, "select create_group('Friends')");
const trip = (gid: string) =>
  value(
    a,
    `select create_group_trip('Rome','2027-03-05','2027-03-07','${gid}')`,
  );
const admin = async (sql: string) => {
  await db.exec("reset role");
  return db.exec(sql);
};
beforeAll(async () => {
  db = await socialDatabase();
  await db.exec(readFileSync("supabase/migrations/0017_groups.sql", "utf8"));
  for (const [i, id] of ids.entries())
    await db.exec(
      `insert into auth.users(id,email) values('${id}','group${i}@illinois.edu');insert into public_profiles(id,username,display_name,adult_confirmed_at) values('${id}','group${i}','Group ${i}',now());insert into social_settings(id,discoverable) values('${id}',true);`,
    );
  for (const id of ids.slice(1)) {
    await q(a, `select request_friend('${id}')`);
    await q(id, `select respond_friend('${a}','accept')`);
  }
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("group and weekend authorization", () => {
  it("creates General, serializes the ten-person cap and denies raw writes", async () => {
    const gid = await group();
    for (const id of ids.slice(1, 10))
      await q(a, `select add_group_friend('${gid}','${id}')`);
    const g = await value<{ members: unknown[]; chats: { id: string }[] }>(
      a,
      `select get_group('${gid}')`,
    );
    expect(g.members).toHaveLength(10);
    expect(g.chats).toHaveLength(1);
    await expect(
      q(a, `select add_group_friend('${gid}','${ids[10]}')`),
    ).rejects.toThrow("WN_GROUP_FULL");
    await expect(
      q(a, `insert into groups(name) values('raw')`),
    ).rejects.toThrow("permission denied");
    expect(await value(ids[10], `select get_group('${gid}')`)).toBeNull();
  });
  it("restricts admin actions, transfers the final admin and removes all chat access", async () => {
    const gid = await group();
    await q(a, `select add_group_friend('${gid}','${b}')`);
    await q(a, `select add_group_friend('${gid}','${c}')`);
    const tid = await trip(gid);
    const cid = await value(
      a,
      `select get_group_trip('${tid}')->>'conversation_id'`,
    );
    await expect(
      q(b, `select update_group('${gid}','Changed','12h')`),
    ).rejects.toThrow("WN_ADMIN_REQUIRED");
    await expect(
      q(b, `select group_member_action('${gid}','${c}','remove')`),
    ).rejects.toThrow("WN_ADMIN_REQUIRED");
    await q(a, `select group_member_action('${gid}','${a}','leave')`);
    expect(await value(a, `select get_chat('${cid}')`)).toBeNull();
    expect(await value(a, `select get_group_trip('${tid}')`)).toBeNull();
    await q(b, `select update_group('${gid}','New admin','12h')`);
    await q(b, `select group_member_action('${gid}','${c}','remove')`);
    expect(await value(c, `select get_chat('${cid}')`)).toBeNull();
  });
  it("rotates invites and refuses expired, full and blocked joins", async () => {
    const gid = await group();
    const token = await value(a, `select group_invite_link('${gid}')`);
    expect(await value(a, `select group_invite_link('${gid}')`)).toBe(token);
    const replacement = await value(
      a,
      `select group_invite_link('${gid}',true)`,
    );
    await expect(
      q(b, `select join_group_by_token('${token}')`),
    ).rejects.toThrow("WN_INVITE_EXPIRED");
    await admin(
      `update group_invites set expires_at=now()-interval '1 second' where token='${replacement}'`,
    );
    await expect(
      q(b, `select join_group_by_token('${replacement}')`),
    ).rejects.toThrow("WN_INVITE_EXPIRED");
    const valid = await value(a, `select group_invite_link('${gid}')`);
    await q(b, `select block_person('${d}')`);
    await q(b, `select join_group_by_token('${valid}')`);
    await expect(
      q(d, `select join_group_by_token('${valid}')`),
    ).rejects.toThrow("WN_GROUP_BLOCKED");
    await q(b, `select unblock_person('${d}')`);
    for (const id of ids.slice(2, 10))
      await q(id, `select join_group_by_token('${valid}')`);
    await expect(
      q(ids[10], `select join_group_by_token('${valid}')`),
    ).rejects.toThrow("WN_GROUP_FULL");
  });
  it("defaults existing/new group members to Going and supports standalone weekends", async () => {
    const gid = await group();
    await q(a, `select add_group_friend('${gid}','${b}')`);
    const tid = await trip(gid);
    await q(a, `select add_group_friend('${gid}','${c}')`);
    const t = await value<{ members: { status: string }[] }>(
      c,
      `select get_group_trip('${tid}')`,
    );
    expect(t.members.map((m) => m.status)).toEqual(["going", "going", "going"]);
    await q(b, `select set_trip_rsvp('${tid}','maybe')`);
    await expect(
      q(d, `select set_trip_rsvp('${tid}','going')`),
    ).rejects.toThrow("WN_TRIP_UNAVAILABLE");
    const solo = await value(
      a,
      `select create_group_trip('Standalone','2027-03-05','2027-03-07',null,array['${b}']::uuid[])`,
    );
    expect(
      await value(b, `select get_group_trip('${solo}')->>'group_id'`),
    ).toBeNull();
    expect(
      await value(
        b,
        `select jsonb_array_length(get_group_trip('${solo}')->'members')`,
      ),
    ).toBe(2);
  });
  it("keeps group mute across existing and newly created weekend chats", async () => {
    const gid = await group();
    await q(a, `select add_group_friend('${gid}','${b}')`);
    await trip(gid);
    await q(b, `select mute_group('${gid}',true)`);
    await trip(gid);
    expect(await value(b, `select (get_group('${gid}')->>'muted')::boolean`)).toBe(true);
    await db.exec("reset role");
    const muted = await db.query<{ muted: boolean }>(`select m.muted from conversation_members m join conversations c on c.id=m.conversation_id where c.group_id='${gid}' and m.user_id='${b}'`);
    expect(muted.rows).toHaveLength(3);
    expect(muted.rows.every((m) => m.muted)).toBe(true);
    await q(b, `select mute_group('${gid}',false)`);
    expect(await value(b, `select (get_group('${gid}')->>'muted')::boolean`)).toBe(false);
  });
  it("only Going members vote; ties stay open and majority applies exactly once", async () => {
    const gid = await group();
    await q(a, `select add_group_friend('${gid}','${b}')`);
    const tid = await trip(gid);
    const pid = await value(
      a,
      `select propose_trip_edit('${tid}','{"max_per_room":4}')`,
    );
    await q(a, `select vote_trip_proposal('${pid}',true)`);
    expect(
      await value(
        a,
        `select get_group_trip('${tid}')->'proposals'->0->>'status'`,
      ),
    ).toBe("open");
    await expect(
      q(c, `select vote_trip_proposal('${pid}',true)`),
    ).rejects.toThrow("WN_GOING_REQUIRED");
    await q(b, `select vote_trip_proposal('${pid}',false)`);
    expect(
      await value(a, `select get_group_trip('${tid}')->>'max_per_room'`),
    ).toBe("2");
    await q(b, `select vote_trip_proposal('${pid}',true)`);
    expect(
      await value(a, `select get_group_trip('${tid}')->>'max_per_room'`),
    ).toBe("4");
    await q(a, `select vote_trip_proposal('${pid}',true)`);
    expect(
      await value(
        a,
        `select count(*)::int from messages where payload->>'proposal_id'='${pid}'`,
      ),
    ).toBe(2);
  });
  it("re-evaluates after someone steps out, excluding their vote", async () => {
    const gid = await group();
    await q(a, `select add_group_friend('${gid}','${b}')`);
    const tid = await trip(gid);
    const pid = await value(
      a,
      `select propose_trip_edit('${tid}','{"mixed_rooms":false}')`,
    );
    await q(a, `select vote_trip_proposal('${pid}',true)`);
    await q(b, `select set_trip_rsvp('${tid}','out')`);
    expect(
      await value(
        a,
        `select get_group_trip('${tid}')->'proposals'->0->>'status'`,
      ),
    ).toBe("passed");
    await expect(
      q(b, `select propose_trip_edit('${tid}','{"max_per_room":3}')`),
    ).rejects.toThrow("WN_GOING_REQUIRED");
  });
  it("expires before a late majority, and cron can resolve without a user", async () => {
    const gid = await group();
    const tid = await trip(gid);
    const pid = await value(
      a,
      `select propose_trip_edit('${tid}','{"max_per_room":3}')`,
    );
    await admin(
      `update edit_proposals set closes_at=now()-interval '1 second' where id='${pid}'`,
    );
    await q(a, `select vote_trip_proposal('${pid}',true)`);
    expect(
      await value(
        a,
        `select get_group_trip('${tid}')->'proposals'->0->>'status'`,
      ),
    ).toBe("failed");
    expect(
      await value(a, `select get_group_trip('${tid}')->>'max_per_room'`),
    ).toBe("2");
    await expect(q(a, "select resolve_due_trip_proposals()")).rejects.toThrow(
      "permission denied",
    );
    const next = await value(
      a,
      `select propose_trip_edit('${tid}','{"max_per_room":3}')`,
    );
    await admin(
      `update edit_proposals set closes_at=now()-interval '1 second' where id='${next}';select set_config('request.jwt.claim.sub','',false);set role service_role;select resolve_due_trip_proposals();`,
    );
    expect(
      await value(
        a,
        `select get_group_trip('${tid}')->'proposals'->0->>'status'`,
      ),
    ).toBe("failed");
  });
  it("rejects unauthorized fields, nulls and malformed stops and dates", async () => {
    const gid = await group();
    const tid = await trip(gid);
    for (const change of [
      { title: "attack" },
      { max_per_room: 10 },
      { mixed_rooms: null },
      { start_date: "2027-01-01" },
      { stops: [{ tripId: "rome" }] },
      { stops: null },
      {
        stops: [
          {
            tripId: "rome",
            nights: 2,
            act: [],
            sig: [],
            l: 0,
            fd: 0,
            secret: "extra",
          },
        ],
      },
    ]) {
      await expect(
        q(a, `select propose_trip_edit('${tid}','${JSON.stringify(change)}')`),
      ).rejects.toThrow();
    }
    expect(
      await value(
        a,
        `select propose_trip_edit('${tid}','{"stops":[{"tripId":"rome","nights":2,"act":[],"sig":[],"l":0,"fd":0}]}')`,
      ),
    ).toBeTruthy();
  });
  it("keeps shortlist votes within one trip and one per person; HTTPS only", async () => {
    const gid = await group();
    const tid = await trip(gid);
    const other = await trip(gid);
    await expect(
      q(a, `select add_lodging_listing('${tid}','http://example.com','Bad')`),
    ).rejects.toThrow();
    const first = await value(
      a,
      `select add_lodging_listing('${tid}','https://example.com/one','One',100,'EUR')`,
    );
    const second = await value(
      a,
      `select add_lodging_listing('${tid}','https://example.com/two','Two')`,
    );
    await q(a, `select vote_lodging_listing('${tid}','${first}')`);
    await q(a, `select vote_lodging_listing('${tid}','${second}')`);
    expect(
      await value(
        a,
        `select (get_group_trip('${tid}')->'shortlist'->0->>'votes')::int`,
      ),
    ).toBe(0);
    expect(
      await value(
        a,
        `select (get_group_trip('${tid}')->'shortlist'->1->>'votes')::int`,
      ),
    ).toBe(1);
    await expect(
      q(a, `select vote_lodging_listing('${other}','${first}')`),
    ).rejects.toThrow();
    await expect(
      q(
        b,
        `select add_lodging_listing('${tid}','https://example.com','Intruder')`,
      ),
    ).rejects.toThrow("WN_TRIP_UNAVAILABLE");
  });
  it("blocks existing shared chats and does not leak a group Seen receipt", async () => {
    const gid = await group();
    await q(a, `select add_group_friend('${gid}','${b}')`);
    const tid = await trip(gid);
    const cid = await value(
      a,
      `select get_group_trip('${tid}')->>'conversation_id'`,
    );
    await admin(
      `update social_settings set read_receipts=true,show_active_status=true where id in ('${a}','${b}')`,
    );
    await q(b, `select mark_chat_read('${cid}')`);
    expect(await value(a, `select get_chat('${cid}')->>'seen_at'`)).toBeNull();
    await q(a, `select block_person('${b}')`);
    expect(await value(a, `select get_chat('${cid}')`)).toBeNull();
    expect(await value(b, `select get_group_trip('${tid}')`)).toBeNull();
    expect(
      await value(a, `select get_group('${gid}')->'members'->1->'profile'`),
    ).toBeNull();
    await q(a, `select group_member_action('${gid}','${b}','remove')`);
    expect(await value(a, `select get_chat('${cid}')`)).not.toBeNull();
    await q(a, `select unblock_person('${b}')`);
  });
  it("account deletion elects another admin and retains system history", async () => {
    const owner = ids[12],
      other = ids[13];
    const gid = await value(owner, "select create_group('Cleanup')");
    const token = await value(owner, `select group_invite_link('${gid}')`);
    await q(other, `select join_group_by_token('${token}')`);
    const tid = await value(
      owner,
      `select create_group_trip('Cleanup trip','2027-03-05','2027-03-07','${gid}')`,
    );
    await q(owner, `select propose_trip_edit('${tid}','{"max_per_room":3}')`);
    await admin(`delete from auth.users where id='${owner}'`);
    await q(other, `select update_group('${gid}','Survives','48h')`);
    expect(
      await value(
        other,
        `select jsonb_array_length(get_group_trip('${tid}')->'members')`,
      ),
    ).toBe(1);
  });
  it("uses private chat photos for thumbnails and rejects a stale account", async () => {
    const gid = await group();
    const tid = await trip(gid);
    const cid = await value(
      a,
      `select get_group_trip('${tid}')->>'conversation_id'`,
    );
    const path = `${cid}/29000000-0000-0000-0000-000000000099.webp`;
    await q(
      a,
      `insert into storage.objects(bucket_id,name) values('chat-photos','${path}')`,
    );
    await expect(
      q(
        a,
        `select add_lodging_listing('${tid}','https://example.com/photo','Photo',null,'EUR','${path}','${b}')`,
      ),
    ).rejects.toThrow("WN_AUTH_REQUIRED");
    await q(
      a,
      `select add_lodging_listing('${tid}','https://example.com/photo','Photo',null,'EUR','${path}','${a}')`,
    );
    expect(
      await value(
        a,
        `select get_group_trip('${tid}')->'shortlist'->0->>'thumbnail_path'`,
      ),
    ).toBe(path);
    const mid = await value(
      a,
      `select get_group_trip('${tid}')->'shortlist'->0->>'photo_message_id'`,
    );
    await q(a, `select delete_message('${mid}')`);
    expect(
      await value(
        a,
        `select get_group_trip('${tid}')->'shortlist'->0->>'thumbnail_path'`,
      ),
    ).toBeNull();
  });
  it("leaving the last standalone weekend deletes its chat and queues photos", async () => {
    const tid = await value(
      a,
      `select create_group_trip('Solo','2027-03-05','2027-03-07')`,
    );
    const cid = await value(
      a,
      `select get_group_trip('${tid}')->>'conversation_id'`,
    );
    await expect(q(c, `select leave_weekend('${tid}')`)).rejects.toThrow(
      "WN_TRIP_UNAVAILABLE",
    );
    await q(a, `select leave_weekend('${tid}')`);
    expect(await value(a, `select get_chat('${cid}')`)).toBeNull();
    await db.exec("reset role");
    expect(
      (
        await db.query(
          `select * from storage_cleanup_queue where bucket='chat-photos' and path='${cid}/'`,
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("keeps internal helpers and all group functions unavailable to anonymous callers", async () => {
    await expect(
      q(a, "select wn_resolve_trip('00000000-0000-0000-0000-000000000000')"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role;set role anon");
    await expect(db.query("select list_groups()")).rejects.toThrow(
      "permission denied",
    );
  });
});

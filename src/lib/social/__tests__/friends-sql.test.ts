import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { socialDatabase, asUser } from './database';
let db: PGlite;
const ids = [1,2,3,4,5,6].map(n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`);
const [a,b,c,d,e,f]=ids;
const call=(id:string,sql:string)=>asUser(db,id,sql);
async function value(id:string,sql:string) { const r=await call(id,sql); return Object.values(r.rows[0] ?? {})[0]; }
beforeAll(async()=>{
  db=await socialDatabase();
  await db.exec(readFileSync('supabase/migrations/0015_friends.sql','utf8'));
  for(const [i,id] of ids.entries()) {
    await db.exec(`insert into auth.users(id,email) values('${id}','person${i}@illinois.edu');
      insert into public.public_profiles(id,username,display_name,adult_confirmed_at,host_city,host_university,home_university,abroad_start,abroad_end,bio,travel_interests)
        values('${id}','person${i}','Person ${i}',now(),'Prague','AAU','Illinois','2027-01-01','2027-05-30','Hello','{food}');
      insert into public.social_settings(id,discoverable,audience,visible_fields,suggest_in_host_city,share_free_weekends,show_mutual_friends)
        values('${id}',true,'friends_of_friends','{bio,host_city,host_university,abroad_dates,travel_interests}',true,true,true);`);
  }
},30000);
afterAll(async()=>{await db?.close();});
describe('Phase 27 PostgreSQL authorization',()=>{
  it('rejects self, duplicate and reverse requests; only recipient accepts',async()=>{
    await expect(call(a,`select request_friend('${a}')`)).rejects.toThrow('WN_INVALID_PERSON');
    await call(b,`select request_friend('${a}')`);
    await expect(call(a,`select request_friend('${b}')`)).rejects.toThrow('WN_REQUEST_EXISTS');
    await expect(call(b,`select request_friend('${a}')`)).rejects.toThrow('WN_REQUEST_EXISTS');
    await expect(call(b,`select respond_friend('${a}','accept')`)).rejects.toThrow('WN_INVALID_FRIEND_ACTION');
    await call(a,`select respond_friend('${b}','accept')`);
    expect(await value(a,`select wn_viewer_access('${b}')`)).toBe('friend');
    expect(await value(b,`select wn_viewer_access('${a}')`)).toBe('friend');
  });
  it('supports decline, cancellation, unfriend, and protects direct writes/other pairs',async()=>{
    await call(a,`select request_friend('${c}')`);
    await expect(call(d,`select respond_friend('${a}','accept')`)).rejects.toThrow();
    await call(c,`select respond_friend('${a}','decline')`);
    await call(c,`select request_friend('${a}')`);
    await call(c,`select respond_friend('${a}','cancel')`);
    expect(await value(a,`select wn_friend_status('${c}')`)).toBe('none');
    await expect(call(a,`insert into friendships(user_low,user_high,requested_by) values('${a}','${c}','${a}')`)).rejects.toThrow('permission denied');
    expect((await call(c,'select * from friendships')).rows).toHaveLength(0);
  });
  it('distinguishes friend, friend of friend and stranger field visibility',async()=>{
    await call(b,`select request_friend('${c}')`); await call(c,`select respond_friend('${b}','accept')`);
    expect(await value(a,`select wn_viewer_access('${c}')`)).toBe('friend_of_friend');
    expect((await value(a,`select get_public_profile('person2')`) as Record<string,unknown>).bio).toBe('Hello');
    expect((await value(d,`select get_public_profile('person2')`) as Record<string,unknown>).bio).toBeUndefined();
    expect(await value(a,`select wn_mutual_friend_count('${c}')`)).toBe(1);
    await call(c,`update social_settings set audience='friends',show_mutual_friends=false where id='${c}'`);
    expect((await value(a,`select get_public_profile('person2')`) as Record<string,unknown>).bio).toBeUndefined();
    expect(await value(a,`select wn_mutual_friend_count('${c}')`)).toBeNull();
  });
  it('search hides private strangers, hidden filters, self and literal wildcard prefixes',async()=>{
    await call(e,`update social_settings set discoverable=false where id='${e}'`);
    const people=(await call(a,`select search_people('Person','{}',0) as p`)).rows as {p:{id:string}}[];
    expect(people.some(r=>r.p.id===e || r.p.id===a)).toBe(false);
    expect((await call(d,`select search_people('','{"host_city":"Prague"}',0)`)).rows).toHaveLength(0);
    expect((await call(d,`select search_people('%','{}',0)`)).rows).toHaveLength(0);
    expect((await call(d,`select search_people('@person0','{}',0)`)).rows).toHaveLength(1);
    expect(JSON.stringify(people)).not.toContain('@illinois.edu');
    await call(a,`select request_friend('${f}')`); await call(f,`select respond_friend('${a}','accept')`);
    await call(f,`update social_settings set discoverable=false where id='${f}'`);
    expect((await call(a,`select search_people('@person5','{}',0)`)).rows).toHaveLength(1);
  });
  it('shares only dates with friends, filters free weekends, and clears immediately on opt-out',async()=>{
    await call(b,`select sync_free_weekends('[{"start_date":"2027-02-06","end_date":"2027-02-07"}]')`);
    expect((await call(a,`select * from free_weekends where user_id='${b}'`)).rows).toHaveLength(1);
    expect((await call(d,`select * from free_weekends where user_id='${b}'`)).rows).toHaveLength(0);
    expect((await call(a,`select search_people('','{"free_weekend":"2027-02-06"}',0)`)).rows).toHaveLength(1);
    await call(b,`update social_settings set share_free_weekends=false where id='${b}'`);
    expect((await call(a,`select * from free_weekends where user_id='${b}'`)).rows).toHaveLength(0);
    await call(b,`select sync_free_weekends('[{"start_date":"2027-02-06","end_date":"2027-02-07"}]')`);
    expect((await call(b,'select * from free_weekends')).rows).toHaveLength(0);
  });
  it('block removes friendships/requests and hides profiles, search, suggestions and free dates both ways',async()=>{
    expect((await call(a,'select suggest_people()')).rows.length).toBeGreaterThan(0);
    await call(a,`select block_person('${b}')`);
    for(const [viewer,target,username] of [[a,b,'person1'],[b,a,'person0']]) {
      expect(await value(viewer,`select wn_viewer_access('${target}')`)).toBe('blocked');
      expect(await value(viewer,`select get_public_profile('${username}')`)).toBeNull();
      expect((await call(viewer,`select search_people('${username}','{}',0)`)).rows).toHaveLength(0);
      expect(JSON.stringify((await call(viewer,'select suggest_people()')).rows)).not.toContain(target);
      await expect(call(viewer,`select request_friend('${target}')`)).rejects.toThrow('WN_PERSON_UNAVAILABLE');
    }
    expect((await call(a,`select * from friendships where '${b}' in (user_low,user_high)`)).rows).toHaveLength(0);
    await call(b,`select unblock_person('${a}')`);
    expect(await value(b,`select wn_viewer_access('${a}')`)).toBe('blocked');
    await call(a,`select unblock_person('${b}')`);
    expect(await value(a,`select wn_friend_status('${b}')`)).toBe('none');
    await call(a,`select request_friend('${b}')`); await call(b,`select block_person('${a}')`);
    expect((await call(a,`select * from friendships where '${b}' in (user_low,user_high)`)).rows).toHaveLength(0);
  });
  it('requires visible fields and opt-in for suggestions and all search filters',async()=>{
    await call(f,`update social_settings set discoverable=true,audience='verified',suggest_in_host_city=true,visible_fields='{host_city,host_university,home_university,abroad_dates,travel_interests}' where id='${f}'`);
    expect((await call(d,`select search_people('@person5','{"host_city":"Prague","host_university":"AAU","home_university":"Illinois","interests":["food","hiking"]}',0)`)).rows).toHaveLength(1);
    expect(JSON.stringify((await call(d,'select suggest_people()')).rows)).toContain(f);
    await call(f,`update social_settings set visible_fields='{host_city}' where id='${f}'`);
    expect((await call(d,`select search_people('@person5','{"home_university":"Illinois"}',0)`)).rows).toHaveLength(0);
    expect((await call(d,`select search_people('@person5','{"interests":["food"]}',0)`)).rows).toHaveLength(0);
    expect(JSON.stringify((await call(d,'select suggest_people()')).rows)).not.toContain(f);
  });
  it('rejects a stale account payload and invalid dates, and removes calendar access on unfriend',async()=>{
    await expect(call(a,`select sync_free_weekends('[]','${d}')`)).rejects.toThrow('WN_AUTH_REQUIRED');
    await call(f,`update social_settings set share_free_weekends=true where id='${f}'`);
    await expect(call(f,`select sync_free_weekends('[{"start_date":"2027-02-07","end_date":"2027-02-06"}]')`)).rejects.toThrow();
    await call(f,`select sync_free_weekends('[{"start_date":"2027-02-06","end_date":"2027-02-07"}]')`);
    expect((await call(a,`select * from free_weekends where user_id='${f}'`)).rows).toHaveLength(1);
    await call(f,`select respond_friend('${a}','unfriend')`);
    expect((await call(a,`select * from free_weekends where user_id='${f}'`)).rows).toHaveLength(0);
  });
  it('anon cannot call RPCs and internal helpers are not public endpoints',async()=>{
    await db.exec('reset role; set role anon;');
    await expect(db.query('select search_people()')).rejects.toThrow('permission denied');
    await call(a,'select 1');
    await expect(call(a,`select wn_lock_social_pair('${d}')`)).rejects.toThrow('permission denied');
  });
});

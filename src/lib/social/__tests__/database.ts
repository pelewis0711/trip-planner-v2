import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export async function socialDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public,storage to anon,authenticated,service_role,supabase_auth_admin;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    grant all on storage.objects to authenticated;
  `);
  const dir=resolve('supabase/migrations');
  for (const name of readdirSync(dir).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
    try { await db.exec(readFileSync(resolve(dir,name),'utf8')); } catch(e) { throw new Error('Migration '+name+': '+String(e), {cause:e}); }
  }
  return db;
}
export async function asUser(db: PGlite, id: string, sql: string) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`);
  return db.query(sql);
}

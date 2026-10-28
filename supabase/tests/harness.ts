// Postgres embebido (PGlite) con los pedazos mínimos de Supabase (roles, auth,
// storage) para aplicar las migraciones y probar RLS sin Docker.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create schema extensions;
  create schema storage;

  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb,
    created_at timestamptz not null default now()
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );

  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid
  );
  alter table storage.objects enable row level security;

  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;
  grant select on storage.buckets to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

export async function createTestDb() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUBS);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Falló la migración ${file}: ${(error as Error).message}`);
    }
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Corre `fn` como el rol indicado (anon o un usuario autenticado) y vuelve a superuser. */
export async function as<T>(db: TestDb, who: "anon" | { id: string }, fn: () => Promise<T>): Promise<T> {
  const role = who === "anon" ? "anon" : "authenticated";
  const sub = who === "anon" ? "" : who.id;
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub}', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

let counter = 0;

export async function createTwitchUser(db: TestDb, login: string) {
  counter += 1;
  const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
  const meta = {
    provider_id: String(100000 + counter),
    sub: String(100000 + counter),
    name: login,
    avatar_url: `https://example.test/${login}.png`,
    custom_claims: { display_name: login.toUpperCase() },
  };
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    `${login}@example.test`,
    JSON.stringify(meta),
  ]);
  return { id };
}

-- ─────────────────────────────────────────────────────────────────────────────
-- Leventia Alting — Supabase schema
-- Run this in the Supabase SQL editor, then paste your project URL + key into
-- electron/supabase-config.ts (or set LVNT_SUPABASE_URL / LVNT_SUPABASE_KEY).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.licenses (
  key                text primary key,
  plan               text        not null default 'basic',   -- subscription tier shown under License
  role               text        not null default 'standard', -- standard | club33 | staff
  status             text        not null default 'active',   -- active | revoked
  expires_at         timestamptz not null,
  hwid               text,                                    -- bound on first activation (one PC per key)
  discord_id         text,
  discord_username   text,
  app_version        text,
  last_heartbeat     timestamptz,
  cookies_total      int         default 0,
  cookies_healthy    int         default 0,
  cookies_expired    int         default 0,
  cookies_last_check timestamptz,
  created_at         timestamptz not null default now()
);

-- Fast lookups by Discord identity
create index if not exists licenses_discord_id_idx       on public.licenses (discord_id);
create index if not exists licenses_discord_username_idx on public.licenses (lower(discord_username));

-- ── Row Level Security ───────────────────────────────────────────────────────
-- If you use the ANON key in the desktop app, enable RLS and add policies that
-- allow reading a row by key and updating only hwid/heartbeat columns. For full
-- staff actions (revoke / extend / set role) call from a trusted context or use
-- the service_role key. Simplest setup: use the service_role key in the app and
-- keep RLS disabled. (Less secure — only do this if you trust all installs.)

-- Example: allow a client to read its own license + bind HWID on first activation
-- alter table public.licenses enable row level security;
-- create policy "read by key"   on public.licenses for select using (true);
-- create policy "bind hwid"     on public.licenses for update using (hwid is null) with check (true);

-- ── Example seed: a staff key bound to nobody yet ────────────────────────────
-- insert into public.licenses (key, plan, role, status, expires_at, discord_id, discord_username)
-- values ('LVNT-BASIC-ABC123-DEF456-20260901', 'basic', 'standard', 'active',
--         '2026-09-01T23:59:59Z', '123456789012345678', 'someuser');

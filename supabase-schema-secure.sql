-- ═══════════════════════════════════════════════════════════════════════════════
-- Leventia Alting — SECURE Supabase schema (RLS + RPC, secrets server-side)
--
-- Run this in the Supabase SQL editor. After running it:
--   • The publishable key can ONLY call the rpc_* functions below.
--   • It can NOT read, dump, edit, or forge rows in the licenses table.
--   • The HMAC signing secrets live ONLY in the database, never in the app.
--
-- This replaces the old open-table setup. Safe to run on an existing DB.
-- ═══════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Tables ─────────────────────────────────────────────────────────────────────

create table if not exists public.licenses (
  key                text primary key,
  plan               text        not null default 'basic',
  role               text        not null default 'standard',
  status             text        not null default 'active',
  expires_at         timestamptz not null,
  hwid               text,
  discord_id         text,
  discord_username   text,
  app_version        text,
  last_heartbeat     timestamptz,
  cookies_total      int default 0,
  cookies_healthy    int default 0,
  cookies_expired    int default 0,
  cookies_last_check timestamptz,
  created_at         timestamptz not null default now()
);

-- Private secrets table — never exposed to the client
create table if not exists public.app_secrets (
  id            int primary key default 1,
  basic_secret  text not null,
  staff_secret  text not null
);

-- Seed the secrets (match the values your existing keys were signed with so they
-- keep working). ROTATE these later for maximum security + reissue keys.
insert into public.app_secrets (id, basic_secret, staff_secret)
values (1,
  'lvnt-basic-2024-X8@j-R%tF-^hM&-nW#p-Qk7v-Bd2e',
  'lvnt-staff-2024-K9#m-P$qN-!vL@-wZ*r-Yt3U-sF^j'
)
on conflict (id) do nothing;

-- ── Lock everything down (RLS on, no policies, no table grants) ────────────────
alter table public.licenses    enable row level security;
alter table public.app_secrets enable row level security;
revoke all on public.licenses    from anon, authenticated;
revoke all on public.app_secrets from anon, authenticated;

-- ── Internal helpers (not callable by the client) ──────────────────────────────

create or replace function public._hmac(p_data text, p_secret text, p_len int)
returns text language sql immutable
set search_path = public, extensions, pg_catalog as $$
  select upper(left(encode(hmac(p_data, p_secret, 'sha256'), 'hex'), p_len));
$$;

create or replace function public._parse_expiry(p_date text)
returns timestamptz language sql immutable as $$
  select case when p_date ~ '^\d{8}$'
    then make_timestamptz(
      left(p_date,4)::int, substr(p_date,5,2)::int, substr(p_date,7,2)::int, 23, 59, 59)
    else null end;
$$;

-- Returns 'staff' | 'basic' | '' (invalid) for a key.
--   Staff keys are validated by HMAC against the DB-only staff_secret.
--   Basic keys are validated by FORMAT only here; their real authority is
--   membership in the licenses table (checked by rpc_activate). This means you
--   can rotate the staff_secret without breaking existing basic keys.
create or replace function public._key_kind(p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare s record; m text[]; expiry timestamptz;
begin
  select * into s from app_secrets where id = 1;

  -- Staff: LVNT-STAFF-XXXXXXXX-YYYYMMDD  (HMAC-verified, DB-only secret)
  m := regexp_match(upper(p_key), '^LVNT-STAFF-([A-F0-9]{8})-(\d{8})$');
  if m is not null then
    expiry := _parse_expiry(m[2]);
    if expiry is null or expiry < now() then return ''; end if;
    if m[1] = _hmac(m[2], s.staff_secret, 8) then return 'staff'; end if;
    return '';
  end if;

  -- Basic / Premium (BASIC | PREMIUM | PREM, any hex segment lengths).
  -- Format only here; the licenses table is the authority and its role gives the tier.
  if upper(p_key) ~ '^LVNT-(BASIC|PREMIUM|PREM)-[A-F0-9]+-[A-F0-9]+-\d{8}$' then
    return 'basic';
  end if;

  return '';
end; $$;

-- Helper to mint a staff key from the DB-only secret (run manually in SQL editor).
-- Usage:  select public.make_staff_key('20280101');
create or replace function public.make_staff_key(p_date text)
returns text language sql security definer set search_path = public as $$
  select 'LVNT-STAFF-' || _hmac(p_date, (select staff_secret from app_secrets where id=1), 8) || '-' || p_date;
$$;
revoke all on function public.make_staff_key(text) from anon, authenticated;

-- Staff = a real LVNT-STAFF (HMAC) key OR any active, non-expired role=staff license
-- (so role=staff keys issued to staff members work for every staff action + stay revocable).
create or replace function public._is_staff(p_key text)
returns boolean language sql security definer set search_path = public as $$
  select _key_kind(p_key) = 'staff'
      or exists (
        select 1 from licenses
        where key = upper(p_key) and role = 'staff'
          and status = 'active' and expires_at > now()
      );
$$;

-- ── Client RPCs (granted to anon) ──────────────────────────────────────────────

-- Activate a key + bind it to one HWID. Returns minimal info only.
create or replace function public.rpc_activate(p_key text, p_hwid text)
returns json language plpgsql security definer set search_path = public as $$
declare kind text; row licenses; expiry timestamptz;
begin
  kind := _key_kind(p_key);
  if kind = '' then return json_build_object('valid', false, 'error', 'Invalid or expired key.'); end if;

  -- Staff keys are master access — valid on any device, no DB row required.
  if kind = 'staff' then
    return json_build_object('valid', true, 'role', 'staff',
      'expiresAt', _parse_expiry(right(upper(p_key), 8)));
  end if;

  -- Basic keys must exist in the table (issued by staff) + bind to one HWID.
  select * into row from licenses where key = upper(p_key);
  if not found then return json_build_object('valid', false, 'error', 'Key not found.'); end if;
  if row.status = 'revoked' then return json_build_object('valid', false, 'error', 'This key has been revoked.'); end if;
  if row.expires_at < now() then return json_build_object('valid', false, 'error', 'This key has expired.'); end if;

  if row.hwid is null then
    update licenses set hwid = p_hwid, last_heartbeat = now() where key = row.key;
  elsif row.hwid <> p_hwid then
    return json_build_object('valid', false, 'error', 'This key is already active on another device.');
  else
    update licenses set last_heartbeat = now() where key = row.key;
  end if;

  return json_build_object('valid', true, 'role', row.role, 'expiresAt', row.expires_at);
end; $$;

-- Heartbeat — only updates the row whose key+hwid match.
create or replace function public.rpc_heartbeat(
  p_key text, p_hwid text, p_version text,
  p_total int, p_healthy int, p_expired int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update licenses set
    last_heartbeat = now(), app_version = p_version,
    cookies_total = p_total, cookies_healthy = p_healthy,
    cookies_expired = p_expired, cookies_last_check = now()
  where key = upper(p_key) and hwid = p_hwid;
end; $$;

-- Staff: issue a new basic key (signed server-side).
create or replace function public.rpc_issue_key(
  p_staff_key text, p_months int, p_role text,
  p_discord_id text, p_discord_username text)
returns json language plpgsql security definer set search_path = public, extensions, pg_catalog as $$
declare s record; uid text; datestr text; sig text; newkey text; expiry timestamptz;
begin
  if not _is_staff(p_staff_key) then return json_build_object('error', 'Staff access required.'); end if;
  select * into s from app_secrets where id = 1;

  expiry  := now() + (p_months || ' months')::interval;
  datestr := to_char(expiry, 'YYYYMMDD');
  uid     := upper(encode(gen_random_bytes(3), 'hex'));
  sig     := _hmac(uid || datestr, s.basic_secret, 6);
  newkey  := case when p_role = 'club33'
               then 'LVNT-PREMIUM-' || uid || '-' || sig || '-' || datestr
               else 'LVNT-BASIC-'   || uid || '-' || sig || '-' || datestr end;

  insert into licenses (key, plan, role, status, expires_at, discord_id, discord_username)
  values (newkey,
    case when p_role = 'staff' then 'staff' when p_role = 'club33' then 'club33' else 'basic' end,
    coalesce(p_role, 'standard'), 'active', expiry,
    nullif(p_discord_id, ''), nullif(p_discord_username, ''));

  return json_build_object('key', newkey, 'expiresAt', expiry, 'role', coalesce(p_role,'standard'), 'months', p_months);
end; $$;

-- Staff: list all issued (non-staff) keys.
create or replace function public.rpc_list_keys(p_staff_key text)
returns setof licenses language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  return query select * from licenses order by created_at desc;
end; $$;

-- Staff: look up a user by Discord id/username.
create or replace function public.rpc_lookup_user(p_staff_key text, p_query text)
returns setof licenses language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  return query
    select * from licenses
    where discord_id = p_query or lower(discord_username) = lower(p_query)
    limit 1;
end; $$;

-- Staff: management actions.
create or replace function public.rpc_reset_hwid(p_staff_key text, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  update licenses set hwid = null where key = upper(p_key);
end; $$;

create or replace function public.rpc_set_status(p_staff_key text, p_key text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  update licenses set status = p_status where key = upper(p_key);
end; $$;

create or replace function public.rpc_extend(p_staff_key text, p_key text, p_days int)
returns void language plpgsql security definer set search_path = public as $$
declare cur timestamptz;
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  select expires_at into cur from licenses where key = upper(p_key);
  if cur is null then raise exception 'Key not found.'; end if;
  update licenses set expires_at = greatest(cur, now()) + (p_days || ' days')::interval where key = upper(p_key);
end; $$;

create or replace function public.rpc_set_role(p_staff_key text, p_key text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  update licenses set role = p_role, plan = p_role where key = upper(p_key);
end; $$;

-- Staff: link a key to a Discord user (powers /link + User Lookup). Staff keys
-- have no stored row, so for those we create the row first, then attach Discord.
create or replace function public.rpc_link_discord(
  p_staff_key text, p_key text, p_discord_id text, p_discord_username text)
returns json language plpgsql security definer set search_path = public, extensions, pg_catalog as $$
declare row licenses; k text; exp timestamptz;
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  k := upper(p_key);
  update licenses
    set discord_id = nullif(p_discord_id, ''), discord_username = nullif(p_discord_username, '')
    where key = k
    returning * into row;
  if not found then
    if k ~ '^LVNT-STAFF-' then
      exp := _parse_expiry(right(k, 8));
      insert into licenses (key, plan, role, status, expires_at, discord_id, discord_username)
      values (k, 'staff', 'staff', 'active', coalesce(exp, now() + interval '100 years'),
        nullif(p_discord_id, ''), nullif(p_discord_username, ''))
      returning * into row;
    else
      return json_build_object('error', 'Key not found.');
    end if;
  end if;
  return json_build_object('key', row.key, 'discordId', row.discord_id,
    'discordUsername', row.discord_username, 'role', row.role, 'expiresAt', row.expires_at);
end; $$;

-- ── Grant ONLY the RPCs to the client roles ────────────────────────────────────
grant execute on function
  public.rpc_activate(text,text),
  public.rpc_heartbeat(text,text,text,int,int,int),
  public.rpc_issue_key(text,int,text,text,text),
  public.rpc_list_keys(text),
  public.rpc_lookup_user(text,text),
  public.rpc_reset_hwid(text,text),
  public.rpc_set_status(text,text,text),
  public.rpc_extend(text,text,int),
  public.rpc_set_role(text,text,text),
  public.rpc_link_discord(text,text,text,text)
to anon, authenticated;

-- Internal helpers stay private
revoke all on function public._hmac(text,text,int)        from anon, authenticated;
revoke all on function public._parse_expiry(text)         from anon, authenticated;
revoke all on function public._key_kind(text)             from anon, authenticated;
revoke all on function public._is_staff(text)             from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATES FEED (shared via the database so every user sees announcements)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.updates (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  body      text not null,
  version   text,
  category  text not null default 'announcement',
  author    text not null default 'Leventia Staff',
  posted_at timestamptz not null default now()
);
alter table public.updates enable row level security;
revoke all on public.updates from anon, authenticated;

-- Anyone may READ updates (public announcements)
create or replace function public.rpc_get_updates()
returns setof public.updates language sql security definer set search_path = public as $$
  select * from updates order by posted_at desc;
$$;

-- Only staff may post
create or replace function public.rpc_post_update(
  p_staff_key text, p_title text, p_body text, p_version text, p_category text)
returns public.updates language plpgsql security definer set search_path = public as $$
declare rec public.updates;
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  insert into updates (title, body, version, category)
  values (p_title, p_body, nullif(p_version, ''), coalesce(nullif(p_category,''), 'announcement'))
  returning * into rec;
  return rec;
end; $$;

-- Only staff may delete
create or replace function public.rpc_delete_update(p_staff_key text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  delete from updates where id = p_id;
end; $$;

grant execute on function public.rpc_get_updates()                          to anon, authenticated;
grant execute on function public.rpc_post_update(text,text,text,text,text)  to anon, authenticated;
grant execute on function public.rpc_delete_update(text,uuid)               to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEADERBOARD (launches / hours / streak / max session — by Discord username)
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.licenses add column if not exists total_launches int default 0;
alter table public.licenses add column if not exists total_minutes  int default 0;
alter table public.licenses add column if not exists day_streak     int default 0;
alter table public.licenses add column if not exists last_active    date;
alter table public.licenses add column if not exists max_session    int default 0;

-- Called each time an alt is launched. Increments launches, updates the
-- session peak, and advances the consecutive-day streak.
create or replace function public.rpc_record_launch(p_key text, p_session_alts int)
returns void language plpgsql security definer set search_path = public as $$
declare la date; st int;
begin
  select last_active, day_streak into la, st from licenses where key = upper(p_key);
  if not found then return; end if;
  if    la = current_date     then st := coalesce(st, 0);
  elsif la = current_date - 1 then st := coalesce(st, 0) + 1;
  else  st := 1;
  end if;
  update licenses set
    total_launches = coalesce(total_launches, 0) + 1,
    max_session    = greatest(coalesce(max_session, 0), coalesce(p_session_alts, 0)),
    day_streak     = st,
    last_active    = current_date
  where key = upper(p_key);
end; $$;

-- Public leaderboard for a given metric: 'launches' | 'hours' | 'streak' | 'maxsession'
create or replace function public.rpc_leaderboard(p_metric text)
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select username, role, value from (
      select discord_username as username, role,
        case p_metric
          when 'hours'      then floor(coalesce(total_minutes, 0) / 60.0)::int
          when 'streak'     then coalesce(day_streak, 0)
          when 'maxsession' then coalesce(max_session, 0)
          else                   coalesce(total_launches, 0)
        end as value
      from licenses
      where discord_username is not null and discord_username <> ''
    ) s
    where value > 0
    order by value desc
    limit 50
  ) t;
$$;

grant execute on function public.rpc_record_launch(text,int) to anon, authenticated;
grant execute on function public.rpc_leaderboard(text)       to anon, authenticated;

-- Heartbeat also counts active minutes (for the Hours leaderboard)
create or replace function public.rpc_heartbeat(
  p_key text, p_hwid text, p_version text,
  p_total int, p_healthy int, p_expired int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update licenses set
    last_heartbeat = now(), app_version = p_version,
    cookies_total = p_total, cookies_healthy = p_healthy,
    cookies_expired = p_expired, cookies_last_check = now(),
    total_minutes = coalesce(total_minutes, 0) + 1
  where key = upper(p_key) and hwid = p_hwid;
end; $$;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════════
-- RECOMMENDED: rotate the staff secret so it differs from anything ever shipped
-- in the app, then mint a fresh staff key (the secret never leaves the database):
--
--   update public.app_secrets
--     set staff_secret = encode(gen_random_bytes(32), 'hex')
--   where id = 1;
--
--   select public.make_staff_key('20280101');   -- copy the result; this is your staff key
--
-- Existing basic keys keep working (validated by table membership), so you only
-- need to hand out the new staff key to yourself / staff.
-- ═══════════════════════════════════════════════════════════════════════════════

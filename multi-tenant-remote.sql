-- ═══════════════════════════════════════════════════════════════════════════════
-- Multi-tenant remote control — updated rpc_self_register to accept ALL key types:
--   • LVNT-STAFF-...   (master HMAC keys — creates a DB row if none exists)
--   • LVNT-PREMIUM-... (existing row — updates Discord info)
--   • LVNT-BASIC-...   (existing row — updates Discord info)
-- Run in Supabase SQL editor (replaces the previous version).
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.rpc_self_register(p_key text, p_discord_id text, p_discord_username text)
returns json language plpgsql security definer set search_path = public, extensions, pg_catalog as $$
declare
  r        licenses;
  k        text  := upper(p_key);
  kind     text  := _key_kind(k);
  exp      timestamptz;
begin
  -- Reject completely unrecognised formats.
  if kind = '' then
    return json_build_object('ok', false, 'error', 'Unrecognised key format. Expected LVNT-STAFF-…, LVNT-PREMIUM-… or LVNT-BASIC-…');
  end if;

  -- ── Master staff key (HMAC-valid, may have no DB row yet) ──────────────────
  if kind = 'staff' then
    exp := _parse_expiry(right(k, 8));
    if exp is null or exp < now() then
      return json_build_object('ok', false, 'error', 'This staff key has expired.');
    end if;

    -- Upsert: create the row if it doesn't exist, or update Discord info if it does.
    insert into licenses (key, plan, role, status, expires_at, discord_id, discord_username)
    values (k, 'staff', 'staff', 'active', exp, p_discord_id, p_discord_username)
    on conflict (key) do update
      set discord_id       = excluded.discord_id,
          discord_username = excluded.discord_username;

    return json_build_object('ok', true, 'role', 'staff', 'expiresAt', exp);
  end if;

  -- ── Basic / Premium key (must already exist in the table) ──────────────────
  select * into r from licenses where key = k;
  if not found then
    return json_build_object('ok', false, 'error', 'Key not found. Make sure you copied it correctly.');
  end if;
  if r.status = 'revoked' then
    return json_build_object('ok', false, 'error', 'This key has been revoked. Contact staff.');
  end if;
  if r.expires_at < now() then
    return json_build_object('ok', false, 'error', 'This key has expired. Contact staff to renew it.');
  end if;

  -- Block hijacking: key already claimed by a DIFFERENT Discord account.
  if r.discord_id is not null and r.discord_id <> p_discord_id then
    return json_build_object('ok', false, 'error', 'This key is already linked to a different Discord account. Contact staff to transfer it.');
  end if;

  update licenses
    set discord_id = p_discord_id, discord_username = p_discord_username
    where key = k;

  return json_build_object('ok', true, 'role', r.role, 'expiresAt', r.expires_at);
end; $$;

-- Look up a worker key by Discord ID (used by /deployalts to find the caller's key).
-- Prefers staff > premium (club33) > basic, then latest expiry — so a Premium key
-- is always chosen over a Basic one when a user has both linked.
create or replace function public.rpc_get_worker_key(p_discord_id text)
returns json language plpgsql security definer set search_path = public as $$
declare r licenses;
begin
  select * into r from licenses
  where discord_id = p_discord_id and status = 'active' and expires_at > now()
  order by (case role when 'staff' then 0 when 'club33' then 1 else 2 end), expires_at desc
  limit 1;
  if not found then return json_build_object('found', false); end if;
  return json_build_object('found', true, 'key', r.key, 'role', r.role, 'expiresAt', r.expires_at);
end; $$;

grant execute on function public.rpc_self_register(text,text,text) to anon, authenticated;
grant execute on function public.rpc_get_worker_key(text)          to anon, authenticated;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Premium keys now generate as LVNT-PREMIUM-…  (Basic stays LVNT-BASIC-…).
-- Both are validated the same way (format + licenses-table membership); the role
-- column (club33 = Premium) still drives the tier/features. Existing keys keep working.
-- Run once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════════

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

  -- Basic / Premium: LVNT-(BASIC|PREMIUM)-UUUUUU-SSSSSS-YYYYMMDD (table is the authority)
  if upper(p_key) ~ '^LVNT-(BASIC|PREMIUM)-[A-F0-9]{6}-[A-F0-9]{6}-\d{8}$' then
    return 'basic';
  end if;

  return '';
end; $$;

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

notify pgrst, 'reload schema';

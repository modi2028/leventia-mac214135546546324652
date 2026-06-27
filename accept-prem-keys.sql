-- ═══════════════════════════════════════════════════════════════════════════════
-- Accept LVNT-PREM-… keys (and any BASIC/PREMIUM variant). For non-staff keys the
-- licenses TABLE is the real authority (rpc_activate looks the row up), so the
-- format check only needs to recognise the shape. This makes keys issued by the
-- erlc-bot (LVNT-PREM-8hex-4hex-date) activate in the app. Run once in Supabase.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public._key_kind(p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare s record; m text[]; expiry timestamptz;
begin
  select * into s from app_secrets where id = 1;

  -- Staff: HMAC-verified master key (unchanged).
  m := regexp_match(upper(p_key), '^LVNT-STAFF-([A-F0-9]{8})-(\d{8})$');
  if m is not null then
    expiry := _parse_expiry(m[2]);
    if expiry is null or expiry < now() then return ''; end if;
    if m[1] = _hmac(m[2], s.staff_secret, 8) then return 'staff'; end if;
    return '';
  end if;

  -- Basic / Premium (BASIC | PREMIUM | PREM, any hex segment lengths) — the
  -- licenses table is the authority, so a key only works if it's actually in it.
  if upper(p_key) ~ '^LVNT-(BASIC|PREMIUM|PREM)-[A-F0-9]+-[A-F0-9]+-\d{8}$' then
    return 'basic';
  end if;

  return '';
end; $$;

notify pgrst, 'reload schema';

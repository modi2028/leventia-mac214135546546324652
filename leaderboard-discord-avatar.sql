-- ═══════════════════════════════════════════════════════════════════════════════
-- Discord avatars on the leaderboard.
--   • adds licenses.discord_avatar (the Discord avatar hash)
--   • /register stores it (bot passes p_discord_avatar)
--   • rpc_leaderboard returns discordId + avatar so the app can show the real PFP
-- Existing users get an avatar the next time they /register. Run once in Supabase.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.licenses add column if not exists discord_avatar text;

-- Old 3-arg signature must go, or calling with 3 args is ambiguous with the new
-- 4-arg (defaulted) version below.
drop function if exists public.rpc_self_register(text, text, text);

create or replace function public.rpc_self_register(
  p_key text, p_discord_id text, p_discord_username text, p_discord_avatar text default null)
returns json language plpgsql security definer set search_path = public, extensions, pg_catalog as $$
declare r licenses; k text := upper(p_key); kind text := _key_kind(k); exp timestamptz;
begin
  if kind = '' then
    return json_build_object('ok', false, 'error', 'Unrecognised key format. Expected LVNT-STAFF-…, LVNT-PREMIUM-… or LVNT-BASIC-…');
  end if;

  if kind = 'staff' then
    exp := _parse_expiry(right(k, 8));
    if exp is null or exp < now() then return json_build_object('ok', false, 'error', 'This staff key has expired.'); end if;
    insert into licenses (key, plan, role, status, expires_at, discord_id, discord_username, discord_avatar)
    values (k, 'staff', 'staff', 'active', exp, p_discord_id, p_discord_username, nullif(p_discord_avatar, ''))
    on conflict (key) do update
      set discord_id = excluded.discord_id,
          discord_username = excluded.discord_username,
          discord_avatar = coalesce(nullif(excluded.discord_avatar, ''), licenses.discord_avatar);
    return json_build_object('ok', true, 'role', 'staff', 'expiresAt', exp);
  end if;

  select * into r from licenses where key = k;
  if not found then return json_build_object('ok', false, 'error', 'Key not found. Make sure you copied it correctly.'); end if;
  if r.status = 'revoked' then return json_build_object('ok', false, 'error', 'This key has been revoked. Contact staff.'); end if;
  if r.expires_at < now() then return json_build_object('ok', false, 'error', 'This key has expired. Contact staff to renew it.'); end if;
  if r.discord_id is not null and r.discord_id <> p_discord_id then
    return json_build_object('ok', false, 'error', 'This key is already linked to a different Discord account. Contact staff to transfer it.');
  end if;

  update licenses
    set discord_id = p_discord_id, discord_username = p_discord_username,
        discord_avatar = coalesce(nullif(p_discord_avatar, ''), discord_avatar)
    where key = k;
  return json_build_object('ok', true, 'role', r.role, 'expiresAt', r.expires_at);
end; $$;

create or replace function public.rpc_leaderboard(p_metric text)
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select username, role, value, "discordId", avatar from (
      select discord_username as username, role,
        discord_id as "discordId", discord_avatar as avatar,
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

grant execute on function public.rpc_self_register(text, text, text, text) to anon, authenticated;
grant execute on function public.rpc_leaderboard(text)                     to anon, authenticated;

notify pgrst, 'reload schema';

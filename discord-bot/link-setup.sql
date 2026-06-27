-- Run this in the Supabase SQL editor to enable / upgrade the bot's /link command.
-- Attaches a Discord user to a key. If the key is a STAFF key (which isn't stored
-- as a row by default), it creates the row first so it can be linked & looked up.

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
    -- Staff keys have no stored row — create one so it can be linked / looked up.
    if k ~ '^LVNT-STAFF-' then
      exp := _parse_expiry(right(k, 8));
      insert into licenses (key, plan, role, status, expires_at, discord_id, discord_username)
      values (k, 'staff', 'staff', 'active',
        coalesce(exp, now() + interval '100 years'),
        nullif(p_discord_id, ''), nullif(p_discord_username, ''))
      returning * into row;
    else
      return json_build_object('error', 'Key not found.');
    end if;
  end if;

  return json_build_object('key', row.key, 'discordId', row.discord_id,
    'discordUsername', row.discord_username, 'role', row.role, 'expiresAt', row.expires_at);
end; $$;

grant execute on function public.rpc_link_discord(text,text,text,text) to anon, authenticated;
notify pgrst, 'reload schema';

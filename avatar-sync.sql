-- ═══════════════════════════════════════════════════════════════════════════════
-- Avatar auto-sync — lets the bot keep every registered user's Discord avatar fresh
-- for the leaderboard. The bot (host only) looks users up BY ID with a low-priv
-- member-only token and writes the avatar hash here. Staff-gated. Run once.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.licenses add column if not exists discord_avatar text;

-- The bot lists which Discord ids to refresh (active, linked licenses).
create or replace function public.rpc_avatar_targets(p_staff_key text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then return '[]'::json; end if;
  return coalesce(
    (select json_agg(distinct discord_id)
     from licenses
     where discord_id is not null and discord_id <> '' and status = 'active'),
    '[]'::json);
end; $$;

-- The bot writes back the freshly-fetched avatar hash for a user id.
create or replace function public.rpc_set_avatar(p_staff_key text, p_discord_id text, p_avatar text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then return; end if;
  update licenses set discord_avatar = nullif(p_avatar, '') where discord_id = p_discord_id;
end; $$;

grant execute on function public.rpc_avatar_targets(text)             to anon, authenticated;
grant execute on function public.rpc_set_avatar(text, text, text)     to anon, authenticated;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════════
-- /unregister support — list a user's linked keys (staff-gated, for the bot's
-- autocomplete) and unlink a key from their Discord. Run once in Supabase.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Staff-gated (the bot passes its staff key + the caller's Discord id) so license
-- keys can't be dumped by an unauthenticated caller.
create or replace function public.rpc_list_my_keys(p_staff_key text, p_discord_id text)
returns setof licenses language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  return query select * from licenses where discord_id = p_discord_id order by expires_at desc;
end; $$;

-- Unlink a key from the caller's Discord — only if it's actually theirs.
create or replace function public.rpc_unregister(p_key text, p_discord_id text)
returns json language plpgsql security definer set search_path = public as $$
declare r licenses;
begin
  select * into r from licenses where key = upper(p_key);
  if not found then return json_build_object('ok', false, 'error', 'Key not found.'); end if;
  if r.discord_id is null or r.discord_id <> p_discord_id then
    return json_build_object('ok', false, 'error', 'That key is not linked to your account.');
  end if;
  update licenses set discord_id = null, discord_username = null where key = upper(p_key);
  return json_build_object('ok', true, 'key', r.key, 'role', r.role);
end; $$;

grant execute on function public.rpc_list_my_keys(text,text) to anon, authenticated;
grant execute on function public.rpc_unregister(text,text)   to anon, authenticated;

notify pgrst, 'reload schema';

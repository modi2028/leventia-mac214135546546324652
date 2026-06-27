-- ═══════════════════════════════════════════════════════════════════════════════
-- OWNER ANNOUNCEMENT — broadcast a message banner to EVERY user, instantly.
--
-- The app reads rpc_get_announcement() on launch + periodically and shows a banner
-- with the message. You set/clear it from the hidden Owner panel (Ctrl+Alt+Shift+K
-- → "Announcement") using the SAME owner_secret as the kill-switch. Reuses the
-- app_secrets row (id = 1) created by owner-killswitch.sql. Run once.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.app_secrets add column if not exists announcement_text  text;
alter table public.app_secrets add column if not exists announcement_level text;   -- info | warn | danger
alter table public.app_secrets add column if not exists announcement_at    timestamptz;

-- Public: the current announcement (text + level + when it was set). No secrets.
create or replace function public.rpc_get_announcement()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'text',  (select announcement_text  from app_secrets where id = 1),
    'level', (select announcement_level from app_secrets where id = 1),
    'at',    (select announcement_at    from app_secrets where id = 1)
  );
$$;

-- Owner-only: set (or clear, by passing empty text) the announcement. Requires the
-- owner_secret; returns a generic "Denied." otherwise.
create or replace function public.rpc_set_announcement(p_owner_secret text, p_text text, p_level text)
returns json language plpgsql security definer set search_path = public as $$
declare s text; t text;
begin
  select owner_secret into s from app_secrets where id = 1;
  if s is null or s = '' or p_owner_secret is null or p_owner_secret <> s then
    return json_build_object('ok', false, 'error', 'Denied.');
  end if;
  t := nullif(btrim(p_text), '');
  update app_secrets set
    announcement_text  = t,
    announcement_level = coalesce(nullif(p_level, ''), 'info'),
    announcement_at    = case when t is null then null else now() end
  where id = 1;
  return json_build_object('ok', true, 'text', t);
end; $$;

grant execute on function public.rpc_get_announcement()                  to anon, authenticated;
grant execute on function public.rpc_set_announcement(text, text, text)  to anon, authenticated;

notify pgrst, 'reload schema';

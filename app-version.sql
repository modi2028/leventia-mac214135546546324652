-- ═══════════════════════════════════════════════════════════════════════════════
-- IN-APP UPDATE CHANNEL — "new version available" notice + download link.
--
-- The app reads rpc_latest_version() on launch and, if the published version is
-- newer than the running build, shows a Download banner that opens download_url.
-- You publish a new version from the hidden Owner panel (Ctrl+Alt+Shift+K →
-- "Publish update") using the SAME owner_secret as the kill-switch, or via SQL
-- below. Reuses the app_secrets row (id = 1) created by owner-killswitch.sql.
--
-- Run once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.app_secrets add column if not exists latest_version text;
alter table public.app_secrets add column if not exists download_url   text;

-- Public: latest published version + its download URL (no secrets exposed).
create or replace function public.rpc_latest_version()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'version', (select latest_version from app_secrets where id = 1),
    'url',     (select download_url   from app_secrets where id = 1)
  );
$$;

-- Owner-only: publish a new version + download link. Requires the owner_secret
-- (same one the kill-switch uses); returns a generic "Denied." otherwise.
create or replace function public.rpc_set_version(p_owner_secret text, p_version text, p_url text)
returns json language plpgsql security definer set search_path = public as $$
declare s text;
begin
  select owner_secret into s from app_secrets where id = 1;
  if s is null or s = '' or p_owner_secret is null or p_owner_secret <> s then
    return json_build_object('ok', false, 'error', 'Denied.');
  end if;
  update app_secrets set latest_version = p_version, download_url = p_url where id = 1;
  return json_build_object('ok', true, 'version', p_version, 'url', p_url);
end; $$;

grant execute on function public.rpc_latest_version()               to anon, authenticated;
grant execute on function public.rpc_set_version(text, text, text)  to anon, authenticated;

-- Optional: set the first version manually (or do it from the Owner panel):
-- update public.app_secrets
--   set latest_version = '2.3.0',
--       download_url   = 'https://your-host/Setup Leventia Alting Program V2.3.exe'
--   where id = 1;

notify pgrst, 'reload schema';

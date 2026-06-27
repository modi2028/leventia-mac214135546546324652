-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: remote alting "PC Not Responding" after registering extra keys.
--
-- rpc_get_worker_key chose the caller's key purely by role (staff > premium >
-- basic). So once a user linked a STAFF key (for admin use), /deployalts started
-- queueing commands to the staff key — but their PC is activated with their
-- PREMIUM key, so the app polls a different worker_key and never claims the
-- command → "PC Not Responding".
--
-- New logic: route to the key whose APP IS ACTUALLY ONLINE. The running Leventia
-- app sends a heartbeat with its activated key, so a recent heartbeat marks the
-- key the PC is really polling with. Role is only a fallback when nothing is live.
-- Run once in the Supabase SQL editor (replaces the previous version).
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.rpc_get_worker_key(p_discord_id text)
returns json language plpgsql security definer set search_path = public as $$
declare r licenses;
begin
  select * into r from licenses
  where discord_id = p_discord_id and status = 'active' and expires_at > now()
  order by
    -- 1) The app that is ONLINE wins (heartbeat within the last 5 min = the PC
    --    that is currently polling with this key). This is what fixes the bug.
    (case when last_heartbeat is not null and last_heartbeat > now() - interval '5 minutes' then 0 else 1 end),
    -- 2) Tier fallback when nothing is heartbeating: staff > premium > basic.
    (case role when 'staff' then 0 when 'club33' then 1 else 2 end),
    -- 3) Freshest heartbeat, then latest expiry.
    last_heartbeat desc nulls last,
    expires_at desc
  limit 1;
  if not found then return json_build_object('found', false); end if;
  return json_build_object('found', true, 'key', r.key, 'role', r.role, 'expiresAt', r.expires_at);
end; $$;

grant execute on function public.rpc_get_worker_key(text) to anon, authenticated;

notify pgrst, 'reload schema';

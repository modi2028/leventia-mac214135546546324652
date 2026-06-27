-- ═══════════════════════════════════════════════════════════════════════════════
-- OWNER KILL-SWITCH — globally disable the program for EVERY user, instantly.
--
-- Gated by an OWNER secret (NOT a staff key), so no other staff can trigger it.
-- The app polls rpc_app_status() on launch + every ~30s; when killed it locks
-- itself and becomes unusable for all users. You reactivate the same way.
--
-- SECURITY: pick a LONG, RANDOM owner_secret (it's the only thing protecting the
-- switch, and rpc_set_kill is callable by anyone who knows it). Never ship it in
-- the app — you type it into the hidden owner panel each time. Run once.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.app_secrets add column if not exists killed       boolean not null default false;
alter table public.app_secrets add column if not exists owner_secret text;

-- ▼ SET THIS ONCE to a long random string only you know, then delete this line:
-- update public.app_secrets set owner_secret = encode(gen_random_bytes(24), 'hex') where id = 1;
--   (run `select owner_secret from app_secrets where id = 1;` once to read+save it)

-- Public: "is the app allowed to run?" Returns only the boolean — no secrets.
create or replace function public.rpc_app_status()
returns json language sql security definer set search_path = public as $$
  select json_build_object('killed', coalesce((select killed from app_secrets where id = 1), false));
$$;

-- Owner-only: flip the switch. Requires the owner_secret; staff keys cannot do this.
-- Returns a generic "Denied." on a wrong/empty secret so it can't be enumerated.
create or replace function public.rpc_set_kill(p_owner_secret text, p_killed boolean)
returns json language plpgsql security definer set search_path = public as $$
declare s text;
begin
  select owner_secret into s from app_secrets where id = 1;
  if s is null or s = '' or p_owner_secret is null or p_owner_secret <> s then
    return json_build_object('ok', false, 'error', 'Denied.');
  end if;
  update app_secrets set killed = p_killed where id = 1;
  return json_build_object('ok', true, 'killed', p_killed);
end; $$;

grant execute on function public.rpc_app_status()             to anon, authenticated;
grant execute on function public.rpc_set_kill(text, boolean)  to anon, authenticated;

notify pgrst, 'reload schema';

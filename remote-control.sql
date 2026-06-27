-- ═══════════════════════════════════════════════════════════════════════════════
-- Remote control: Discord bot → command queue → alting program (worker) executes.
-- The bot (staff) queues commands for a worker (identified by its license key);
-- the running Leventia app polls + claims + executes + acks them. Run once.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.remote_commands (
  id          uuid primary key default gen_random_uuid(),
  worker_key  text not null,
  type        text not null,                         -- deploy | remove | stop | status | antiafk
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending',       -- pending | running | done | error
  result      text,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  done_at     timestamptz
);
alter table public.remote_commands enable row level security;
revoke all on public.remote_commands from anon, authenticated;
create index if not exists remote_commands_worker_idx on public.remote_commands (worker_key, status);

-- Staff enqueues a command for a worker (its license key). Returns the new id.
create or replace function public.rpc_queue_command(p_staff_key text, p_worker_key text, p_type text, p_payload jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  insert into remote_commands (worker_key, type, payload)
  values (upper(p_worker_key), p_type, coalesce(p_payload, '{}'::jsonb))
  returning id into new_id;
  return json_build_object('id', new_id);
end; $$;

-- The worker (app) polls for + claims its pending commands.
create or replace function public.rpc_poll_commands(p_key text)
returns setof remote_commands language plpgsql security definer set search_path = public as $$
begin
  if _key_kind(p_key) = '' then return; end if;   -- must hold a valid key
  return query
    update remote_commands set status = 'running', claimed_at = now()
    where id in (
      select id from remote_commands
      where worker_key = upper(p_key) and status = 'pending'
      order by created_at limit 10)
    returning *;
end; $$;

-- The worker reports a command's outcome.
create or replace function public.rpc_ack_command(p_key text, p_id uuid, p_status text, p_result text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update remote_commands
  set status = p_status, result = p_result, done_at = now()
  where id = p_id and worker_key = upper(p_key);
end; $$;

-- Staff reads a command's current state (for the bot to show progress/results).
create or replace function public.rpc_get_command(p_staff_key text, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare r remote_commands;
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  select * into r from remote_commands where id = p_id;
  if not found then return json_build_object('status', 'missing'); end if;
  return json_build_object('status', r.status, 'result', r.result, 'type', r.type);
end; $$;

grant execute on function
  public.rpc_queue_command(text,text,text,jsonb),
  public.rpc_poll_commands(text),
  public.rpc_ack_command(text,uuid,text,text),
  public.rpc_get_command(text,uuid)
to anon, authenticated;

notify pgrst, 'reload schema';

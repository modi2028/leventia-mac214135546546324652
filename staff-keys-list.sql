-- Show staff-role keys in the app's key list (Staff → Keys) so they can be
-- extended / revoked there. (They were previously hidden.) Run once in Supabase.
create or replace function public.rpc_list_keys(p_staff_key text)
returns setof licenses language plpgsql security definer set search_path = public as $$
begin
  if not _is_staff(p_staff_key) then raise exception 'Staff access required.'; end if;
  return query select * from licenses order by created_at desc;
end; $$;
notify pgrst, 'reload schema';

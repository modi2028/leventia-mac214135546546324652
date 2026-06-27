-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: let role=staff license rows act as staff for ALL staff actions.
--
-- Problem: _is_staff() only recognised real LVNT-STAFF (HMAC) keys, so keys issued
-- with role=staff (the distributable LVNT-BASIC ones) could see the Staff tab but
-- got "Staff access required" for User Lookup / Extend / Revoke / Issue.
--
-- After running this, any ACTIVE, non-expired license whose role = 'staff' is
-- treated as staff. Revoking it (status != 'active') or letting it expire instantly
-- removes that power — so staff access stays handout-able AND revocable.
--
-- Run once in the Supabase SQL editor. Existing real LVNT-STAFF keys keep working.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public._is_staff(p_key text)
returns boolean language sql security definer set search_path = public as $$
  select _key_kind(p_key) = 'staff'
      or exists (
        select 1 from licenses
        where key = upper(p_key)
          and role = 'staff'
          and status = 'active'
          and expires_at > now()
      );
$$;

notify pgrst, 'reload schema';

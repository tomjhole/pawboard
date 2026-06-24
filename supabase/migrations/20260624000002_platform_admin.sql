-- =============================================================================
-- PawBoard — Platform admin & self-service onboarding
-- Migration: 20260624000002_platform_admin.sql
-- =============================================================================

-- Platform admin registry
create table platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Per-admin business view override (which business the admin is currently viewing)
create table admin_business_views (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  updated_at  timestamptz not null default now()
);

-- ─── Helper functions ─────────────────────────────────────────────────────────

-- Check if the current user is a platform admin
create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from platform_admins where user_id = auth.uid());
$$;

-- Get the business_id an admin has selected to view (null if none set)
create or replace function get_admin_view_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from admin_business_views where user_id = auth.uid();
$$;

-- Override get_current_business_id to honour admin view selection
create or replace function get_current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case when exists(select 1 from platform_admins where user_id = auth.uid())
      then (select business_id from admin_business_views where user_id = auth.uid())
    end,
    (select business_id from staff_users where id = auth.uid() and is_active = true limit 1)
  );
$$;

-- Set which business an admin is currently viewing (null clears the override)
create or replace function set_admin_view(target_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;

  if target_business_id is null then
    delete from admin_business_views where user_id = auth.uid();
  else
    insert into admin_business_views (user_id, business_id, updated_at)
    values (auth.uid(), target_business_id, now())
    on conflict (user_id) do update
      set business_id = excluded.business_id,
          updated_at  = excluded.updated_at;
  end if;
end;
$$;

-- List all businesses (admin only — bypasses RLS)
create or replace function get_all_businesses_admin()
returns setof businesses
language sql
security definer
set search_path = public
as $$
  select * from businesses
  where exists(select 1 from platform_admins where user_id = auth.uid())
  order by name;
$$;

-- Create a new business + owner staff record atomically (for self-service onboarding)
create or replace function create_business_and_owner(
  p_name       text,
  p_slug       text,
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_phone      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists(select 1 from staff_users where id = auth.uid() and is_active = true) then
    raise exception 'User already belongs to a business';
  end if;

  if exists(select 1 from businesses where slug = p_slug) then
    raise exception 'That business name is already taken — try a different one';
  end if;

  insert into businesses (name, slug)
  values (p_name, p_slug)
  returning id into v_business_id;

  insert into staff_users (id, business_id, role, first_name, last_name, email, phone)
  values (auth.uid(), v_business_id, 'owner', p_first_name, p_last_name, p_email, p_phone);

  return v_business_id;
end;
$$;

-- List platform admins with their email (reads auth.users — security definer)
create or replace function list_platform_admins()
returns table(user_id uuid, email text, created_at timestamptz)
language sql
security definer
set search_path = public, auth
as $$
  select pa.user_id, u.email::text, pa.created_at
  from platform_admins pa
  join auth.users u on u.id = pa.user_id
  where exists(select 1 from platform_admins where user_id = auth.uid())
  order by pa.created_at;
$$;

-- Grant platform admin by email (security definer — needs access to auth.users)
create or replace function grant_platform_admin_by_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  if not exists(select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;

  if v_user_id is null then
    raise exception 'No account found for %', p_email;
  end if;

  insert into platform_admins (user_id) values (v_user_id)
  on conflict do nothing;
end;
$$;

-- Revoke platform admin
create or replace function revoke_platform_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot revoke your own admin access';
  end if;

  delete from platform_admins where user_id = p_user_id;
end;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────────

grant execute on function is_platform_admin()                                        to authenticated;
grant execute on function get_admin_view_business_id()                               to authenticated;
grant execute on function set_admin_view(uuid)                                       to authenticated;
grant execute on function get_all_businesses_admin()                                 to authenticated;
grant execute on function create_business_and_owner(text,text,text,text,text,text)   to authenticated;
grant execute on function list_platform_admins()                                     to authenticated;
grant execute on function grant_platform_admin_by_email(text)                        to authenticated;
grant execute on function revoke_platform_admin(uuid)                                to authenticated;

-- Create a business with no staff record (admin use only)
create or replace function create_business_admin(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if not exists(select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;

  if exists(select 1 from businesses where slug = p_slug) then
    raise exception 'That business name is already taken — try a different one';
  end if;

  insert into businesses (name, slug)
  values (p_name, p_slug)
  returning id into v_business_id;

  return v_business_id;
end;
$$;

-- Delete a business and all its data (cascades via FK)
create or replace function delete_business_admin(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;

  delete from businesses where id = p_business_id;
end;
$$;

grant execute on function create_business_admin(text, text) to authenticated;
grant execute on function delete_business_admin(uuid)       to authenticated;

begin;

create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  previous_ids uuid[];
  current_user_id uuid := (select auth.uid());
begin
  select id into target_id
  from public.households
  where invite_code = upper(trim(code));

  if target_id is null then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  select coalesce(array_agg(household_id), '{}'::uuid[]) into previous_ids
  from public.household_members
  where user_id = current_user_id;

  update public.daily_items
  set household_id = target_id
  where created_by = current_user_id
    and household_id = any(previous_ids)
    and household_id <> target_id;

  delete from public.household_members where user_id = current_user_id;
  insert into public.household_members (household_id, user_id, role)
  values (target_id, current_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  delete from public.households h
  where h.id = any(previous_ids)
    and h.id <> target_id
    and not exists (select 1 from public.household_members m where m.household_id = h.id);

  return target_id;
end;
$$;

drop policy if exists items_select_member on public.daily_items;
drop policy if exists items_insert_member on public.daily_items;
drop policy if exists items_update_member on public.daily_items;
drop policy if exists items_delete_member on public.daily_items;

create policy items_select_owner on public.daily_items for select to authenticated
using (created_by = (select auth.uid()) and public.is_household_member(household_id));
create policy items_insert_owner on public.daily_items for insert to authenticated
with check (created_by = (select auth.uid()) and public.is_household_member(household_id));
create policy items_update_owner on public.daily_items for update to authenticated
using (created_by = (select auth.uid()) and public.is_household_member(household_id))
with check (created_by = (select auth.uid()) and public.is_household_member(household_id));
create policy items_delete_owner on public.daily_items for delete to authenticated
using (created_by = (select auth.uid()) and public.is_household_member(household_id));

drop policy if exists records_select_member on public.daily_records;
drop policy if exists records_insert_member on public.daily_records;
drop policy if exists records_update_member on public.daily_records;
drop policy if exists records_delete_member on public.daily_records;

create policy records_select_owner on public.daily_records for select to authenticated
using (recorded_by = (select auth.uid()) and exists (
  select 1 from public.daily_items item where item.id = item_id and item.created_by = (select auth.uid())
));
create policy records_insert_owner on public.daily_records for insert to authenticated
with check (recorded_by = (select auth.uid()) and exists (
  select 1 from public.daily_items item where item.id = item_id and item.created_by = (select auth.uid())
));
create policy records_update_owner on public.daily_records for update to authenticated
using (recorded_by = (select auth.uid()) and exists (
  select 1 from public.daily_items item where item.id = item_id and item.created_by = (select auth.uid())
)) with check (recorded_by = (select auth.uid()) and exists (
  select 1 from public.daily_items item where item.id = item_id and item.created_by = (select auth.uid())
));
create policy records_delete_owner on public.daily_records for delete to authenticated
using (recorded_by = (select auth.uid()) and exists (
  select 1 from public.daily_items item where item.id = item_id and item.created_by = (select auth.uid())
));

commit;

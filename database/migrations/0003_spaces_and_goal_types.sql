begin;

-- 실행 전 database/verification/0003_preflight.sql 결과를 별도 보관한다.
alter table public.households add column if not exists space_type text;
alter table public.households add column if not exists personal_owner_id uuid references public.profiles(id);
update public.households set space_type = 'shared' where space_type is null;
alter table public.households alter column space_type set default 'shared';
alter table public.households alter column space_type set not null;
alter table public.households drop constraint if exists households_space_type_check;
alter table public.households add constraint households_space_type_check check (space_type in ('personal', 'shared'));
create unique index if not exists households_personal_owner_key on public.households(personal_owner_id) where personal_owner_id is not null;

alter table public.household_members drop constraint if exists household_members_user_id_key;

-- 모든 사용자에게 기존 공간과 독립적인 영구 개인 공간을 생성한다.
insert into public.households (name, created_by, space_type, personal_owner_id)
select '내 공간', p.id, 'personal', p.id
from public.profiles p
where not exists (select 1 from public.households h where h.personal_owner_id = p.id);

insert into public.household_members (household_id, user_id, role)
select h.id, h.personal_owner_id, 'owner'
from public.households h
where h.space_type = 'personal'
on conflict (household_id, user_id) do nothing;

-- 기존 항목은 생성자의 개인 공간으로 옮기고 기록은 item FK를 통해 그대로 보존한다.
update public.daily_items item
set household_id = personal.id
from public.households personal
where personal.personal_owner_id = item.created_by
  and personal.space_type = 'personal';

-- 혼자만 있던 레거시 공유 공간은 비우고 제거한다. 둘 이상인 공간은 우리 공간으로 유지한다.
delete from public.households h
where h.space_type = 'shared'
  and (select count(*) from public.household_members m where m.household_id = h.id) < 2;

alter table public.daily_items add column if not exists goal_type text not null default 'check';
alter table public.daily_items add column if not exists target_count integer not null default 1;
alter table public.daily_items add column if not exists comparison text;
alter table public.daily_items add column if not exists min_value numeric;
alter table public.daily_items add column if not exists max_value numeric;
alter table public.daily_items add column if not exists unit text;
alter table public.daily_items drop constraint if exists daily_items_goal_type_check;
alter table public.daily_items add constraint daily_items_goal_type_check check (goal_type in ('check', 'count', 'restraint', 'numeric'));
alter table public.daily_items drop constraint if exists daily_items_target_count_check;
alter table public.daily_items add constraint daily_items_target_count_check check (target_count >= 1 and target_count <= 999);
alter table public.daily_items drop constraint if exists daily_items_comparison_check;
alter table public.daily_items add constraint daily_items_comparison_check check (comparison is null or comparison in ('min', 'max', 'range'));
alter table public.daily_items drop constraint if exists daily_items_unit_check;
alter table public.daily_items add constraint daily_items_unit_check check (unit is null or char_length(trim(unit)) between 1 and 12);
alter table public.daily_items drop constraint if exists daily_items_goal_config_check;
alter table public.daily_items add constraint daily_items_goal_config_check check (
  (goal_type = 'check' and target_count = 1 and comparison is null and min_value is null and max_value is null)
  or (goal_type = 'count' and comparison is null and min_value is null and max_value is null)
  or (goal_type = 'restraint' and target_count = 1 and comparison is null and min_value is null and max_value is null)
  or (goal_type = 'numeric' and comparison is not null
    and (comparison <> 'min' or min_value is not null)
    and (comparison <> 'max' or max_value is not null)
    and (comparison <> 'range' or (min_value is not null and max_value is not null and min_value <= max_value)))
);

alter table public.daily_records drop constraint if exists daily_records_item_id_record_date_key;
alter table public.daily_records drop constraint if exists daily_records_count_check;
alter table public.daily_records add column if not exists status text;
alter table public.daily_records add column if not exists numeric_value numeric;
alter table public.daily_records add constraint daily_records_count_check check (count between 0 and 999);
alter table public.daily_records drop constraint if exists daily_records_status_check;
alter table public.daily_records add constraint daily_records_status_check check (status is null or status in ('success', 'failure'));
alter table public.daily_records add constraint daily_records_user_date_key unique (item_id, recorded_by, record_date);

create table if not exists public.goal_schedules (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.daily_items(id) on delete cascade,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekdays', 'weekly', 'monthly')),
  interval integer not null default 1 check (interval in (1, 2)),
  days_of_week smallint[],
  target_count_per_period integer,
  day_of_month smallint,
  starts_on date not null default (timezone('Asia/Seoul', now()))::date,
  timezone text not null default 'Asia/Seoul' check (timezone = 'Asia/Seoul'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (days_of_week is null or days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]),
  check (target_count_per_period is null or target_count_per_period between 1 and 99),
  check (day_of_month is null or day_of_month between 1 and 31),
  check (
    (frequency = 'daily' and days_of_week is null and target_count_per_period is null and day_of_month is null)
    or (frequency = 'weekdays' and cardinality(days_of_week) > 0 and target_count_per_period is null and day_of_month is null)
    or (frequency = 'weekly' and days_of_week is null and target_count_per_period is not null and day_of_month is null)
    or (frequency = 'monthly' and days_of_week is null and target_count_per_period is null and day_of_month is not null)
  )
);
create trigger goal_schedules_set_updated_at before update on public.goal_schedules
for each row execute function public.set_updated_at();

create or replace function public.validate_goal_record()
returns trigger language plpgsql set search_path = '' as $$
declare item public.daily_items;
begin
  select * into item from public.daily_items where id = new.item_id;
  if item.goal_type = 'check' and not (new.count in (0, 1) and new.status is null and new.numeric_value is null) then raise exception 'INVALID_CHECK_RECORD'; end if;
  if item.goal_type = 'count' and not (new.count between 0 and item.target_count and new.status is null and new.numeric_value is null) then raise exception 'INVALID_COUNT_RECORD'; end if;
  if item.goal_type = 'restraint' and not (new.count = 0 and new.status is not null and new.numeric_value is null) then raise exception 'INVALID_RESTRAINT_RECORD'; end if;
  if item.goal_type = 'numeric' and not (new.count = 0 and new.status is null and new.numeric_value is not null) then raise exception 'INVALID_NUMERIC_RECORD'; end if;
  return new;
end;
$$;
create trigger daily_records_validate_goal before insert or update on public.daily_records
for each row execute function public.validate_goal_record();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare personal_id uuid; display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '사용자');
  insert into public.profiles (id, nickname, profile_image_url)
  values (new.id, left(display_name, 30), coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'));
  insert into public.households (name, created_by, space_type, personal_owner_id)
  values ('내 공간', new.id, 'personal', new.id) returning id into personal_id;
  insert into public.household_members (household_id, user_id, role) values (personal_id, new.id, 'owner');
  return new;
end;
$$;

create or replace function public.create_shared_space(space_name text default '우리 공간')
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; current_user_id uuid := (select auth.uid());
begin
  if exists (select 1 from public.household_members m join public.households h on h.id = m.household_id where m.user_id = current_user_id and h.space_type = 'shared') then
    raise exception 'SHARED_SPACE_ALREADY_EXISTS';
  end if;
  insert into public.households (name, created_by, space_type) values (left(trim(space_name), 40), current_user_id, 'shared') returning id into new_id;
  insert into public.household_members (household_id, user_id, role) values (new_id, current_user_id, 'owner');
  return new_id;
end;
$$;

create or replace function public.join_shared_space(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid; current_user_id uuid := (select auth.uid());
begin
  if exists (select 1 from public.household_members m join public.households h on h.id = m.household_id where m.user_id = current_user_id and h.space_type = 'shared') then
    raise exception 'SHARED_SPACE_ALREADY_EXISTS';
  end if;
  select id into target_id from public.households where invite_code = upper(trim(code)) and space_type = 'shared';
  if target_id is null then raise exception 'INVALID_INVITE_CODE'; end if;
  if (select count(*) from public.household_members where household_id = target_id) >= 2 then raise exception 'SHARED_SPACE_FULL'; end if;
  insert into public.household_members (household_id, user_id, role) values (target_id, current_user_id, 'member');
  return target_id;
end;
$$;

create or replace function public.join_household(code text)
returns uuid language sql security definer set search_path = '' as $$ select public.join_shared_space(code); $$;

create or replace function public.leave_shared_space(target_space_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); remaining_user_id uuid;
begin
  if not exists (select 1 from public.household_members m join public.households h on h.id = m.household_id where m.household_id = target_space_id and m.user_id = current_user_id and h.space_type = 'shared') then
    raise exception 'NOT_A_MEMBER';
  end if;
  select user_id into remaining_user_id from public.household_members where household_id = target_space_id and user_id <> current_user_id limit 1;
  if remaining_user_id is null then raise exception 'LAST_MEMBER_CANNOT_LEAVE'; end if;
  update public.household_members set role = 'owner' where household_id = target_space_id and user_id = remaining_user_id;
  update public.households set created_by = remaining_user_id where id = target_space_id and created_by = current_user_id;
  delete from public.household_members where household_id = target_space_id and user_id = current_user_id;
end;
$$;

alter table public.goal_schedules enable row level security;

drop policy if exists items_select_owner on public.daily_items;
drop policy if exists items_insert_owner on public.daily_items;
drop policy if exists items_update_owner on public.daily_items;
drop policy if exists items_delete_owner on public.daily_items;
drop policy if exists items_select_member on public.daily_items;
drop policy if exists items_insert_member on public.daily_items;
drop policy if exists items_update_member on public.daily_items;
drop policy if exists items_delete_member on public.daily_items;
create policy items_select_space on public.daily_items for select to authenticated using (public.is_household_member(household_id));
create policy items_insert_space on public.daily_items for insert to authenticated with check (created_by = (select auth.uid()) and public.is_household_member(household_id));
create policy items_update_space on public.daily_items for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy items_delete_space on public.daily_items for delete to authenticated using (public.is_household_member(household_id));

drop policy if exists records_select_owner on public.daily_records;
drop policy if exists records_insert_owner on public.daily_records;
drop policy if exists records_update_owner on public.daily_records;
drop policy if exists records_delete_owner on public.daily_records;
drop policy if exists records_select_member on public.daily_records;
drop policy if exists records_insert_member on public.daily_records;
drop policy if exists records_update_member on public.daily_records;
drop policy if exists records_delete_member on public.daily_records;
create policy records_select_space on public.daily_records for select to authenticated using (exists (select 1 from public.daily_items item where item.id = item_id and public.is_household_member(item.household_id)));
create policy records_insert_self on public.daily_records for insert to authenticated with check (recorded_by = (select auth.uid()) and exists (select 1 from public.daily_items item where item.id = item_id and public.is_household_member(item.household_id)));
create policy records_update_self on public.daily_records for update to authenticated using (recorded_by = (select auth.uid())) with check (recorded_by = (select auth.uid()));
create policy records_delete_self on public.daily_records for delete to authenticated using (recorded_by = (select auth.uid()));

create policy schedules_select_space on public.goal_schedules for select to authenticated using (exists (select 1 from public.daily_items item where item.id = item_id and public.is_household_member(item.household_id)));
create policy schedules_insert_space on public.goal_schedules for insert to authenticated with check (exists (select 1 from public.daily_items item where item.id = item_id and public.is_household_member(item.household_id)));
create policy schedules_update_space on public.goal_schedules for update to authenticated using (exists (select 1 from public.daily_items item where item.id = item_id and public.is_household_member(item.household_id)));
create policy schedules_delete_space on public.goal_schedules for delete to authenticated using (exists (select 1 from public.daily_items item where item.id = item_id and public.is_household_member(item.household_id)));

grant select, insert, update, delete on public.goal_schedules to authenticated;
revoke all on function public.create_shared_space(text) from public;
revoke all on function public.join_shared_space(text) from public;
revoke all on function public.leave_shared_space(uuid) from public;
grant execute on function public.create_shared_space(text), public.join_shared_space(text), public.leave_shared_space(uuid) to authenticated;

commit;

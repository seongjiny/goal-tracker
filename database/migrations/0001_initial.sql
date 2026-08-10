begin;

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '사용자' check (char_length(nickname) between 1 and 30),
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리 집' check (char_length(name) between 1 and 40),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8)),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.daily_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 80),
  icon text,
  color text,
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_records (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.daily_items(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id),
  record_date date not null,
  count smallint not null default 1 check (count between 0 and 1),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, record_date)
);

create index daily_items_household_sort_idx on public.daily_items(household_id, sort_order);
create index daily_records_item_date_idx on public.daily_records(item_id, record_date desc);
create index household_members_user_idx on public.household_members(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger households_set_updated_at before update on public.households
for each row execute function public.set_updated_at();
create trigger daily_items_set_updated_at before update on public.daily_items
for each row execute function public.set_updated_at();
create trigger daily_records_set_updated_at before update on public.daily_records
for each row execute function public.set_updated_at();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.shares_household(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = (select auth.uid()) or exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_user_id
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
  display_name text;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    '사용자'
  );

  insert into public.profiles (id, nickname, profile_image_url)
  values (
    new.id,
    left(display_name, 30),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );

  insert into public.households (name, created_by)
  values ('우리 집', new.id)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  previous_ids uuid[];
begin
  select id into target_id
  from public.households
  where invite_code = upper(trim(code));

  if target_id is null then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  select coalesce(array_agg(household_id), '{}'::uuid[]) into previous_ids
  from public.household_members
  where user_id = (select auth.uid());

  delete from public.household_members where user_id = (select auth.uid());
  insert into public.household_members (household_id, user_id, role)
  values (target_id, (select auth.uid()), 'member');

  delete from public.households h
  where h.id = any(previous_ids)
    and h.id <> target_id
    and not exists (select 1 from public.household_members m where m.household_id = h.id);

  return target_id;
end;
$$;

revoke all on function public.join_household(text) from public;
grant execute on function public.join_household(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.daily_items enable row level security;
alter table public.daily_records enable row level security;

create policy profiles_select_shared on public.profiles for select to authenticated
using (public.shares_household(id));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy households_select_member on public.households for select to authenticated
using (public.is_household_member(id));
create policy households_update_owner on public.households for update to authenticated
using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create policy members_select_household on public.household_members for select to authenticated
using (public.is_household_member(household_id));

create policy items_select_member on public.daily_items for select to authenticated
using (public.is_household_member(household_id));
create policy items_insert_member on public.daily_items for insert to authenticated
with check (public.is_household_member(household_id) and created_by = (select auth.uid()));
create policy items_update_member on public.daily_items for update to authenticated
using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy items_delete_member on public.daily_items for delete to authenticated
using (public.is_household_member(household_id));

create policy records_select_member on public.daily_records for select to authenticated
using (exists (
  select 1 from public.daily_items item
  where item.id = item_id and public.is_household_member(item.household_id)
));
create policy records_insert_member on public.daily_records for insert to authenticated
with check (recorded_by = (select auth.uid()) and exists (
  select 1 from public.daily_items item
  where item.id = item_id and public.is_household_member(item.household_id)
));
create policy records_update_member on public.daily_records for update to authenticated
using (exists (
  select 1 from public.daily_items item
  where item.id = item_id and public.is_household_member(item.household_id)
)) with check (recorded_by = (select auth.uid()));
create policy records_delete_member on public.daily_records for delete to authenticated
using (exists (
  select 1 from public.daily_items item
  where item.id = item_id and public.is_household_member(item.household_id)
));

grant select, update on public.profiles to authenticated;
grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.daily_items to authenticated;
grant select, insert, update, delete on public.daily_records to authenticated;

commit;

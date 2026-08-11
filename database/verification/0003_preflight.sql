-- 0003 실행 전에 결과를 저장한다. 이 파일은 데이터를 변경하지 않는다.
select 'profiles' as entity, count(*) as row_count from public.profiles
union all select 'households', count(*) from public.households
union all select 'memberships', count(*) from public.household_members
union all select 'items', count(*) from public.daily_items
union all select 'records', count(*) from public.daily_records;

select created_by, count(*) as item_count from public.daily_items group by created_by order by created_by;
select recorded_by, count(*) as record_count from public.daily_records group by recorded_by order by recorded_by;
select r.id from public.daily_records r left join public.daily_items i on i.id = r.item_id where i.id is null;

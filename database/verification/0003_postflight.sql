-- 0003 실행 후 0행이어야 하는 무결성 검사다.
select p.id from public.profiles p
left join public.households h on h.personal_owner_id = p.id and h.space_type = 'personal'
where h.id is null;

select i.id from public.daily_items i
join public.households h on h.id = i.household_id
where h.space_type <> 'personal' or h.personal_owner_id <> i.created_by;

select r.item_id, r.recorded_by, r.record_date, count(*)
from public.daily_records r
group by r.item_id, r.recorded_by, r.record_date having count(*) > 1;

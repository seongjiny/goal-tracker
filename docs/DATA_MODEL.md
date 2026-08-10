# 데이터 모델

실행 SQL은 `database/migrations/0001_initial.sql`을 기준으로 한다.

## 관계

```text
auth.users 1─1 profiles
profiles 1─1 household_members N─1 households
households 1─N daily_items
daily_items 1─N daily_records
```

## 핵심 규칙

- 사용자는 한 Household에 속한다.
- 첫 로그인 시 profile과 개인 Household가 자동 생성된다.
- 초대 코드 참여 시 기존 초기 Household에서 새 Household로 이동한다.
- Daily Item은 Household 공동 항목이다.
- `(item_id, record_date)`는 고유하며 하루 한 번만 완료된다.
- `record_date`는 `Asia/Seoul`에서 계산한 날짜를 저장한다.
- 항목 중단은 삭제가 아니라 `archived_at`을 설정한다.
- 모든 공개 테이블은 RLS를 사용한다.

## 향후 확장

- 2차에서 `daily_items.target_count`와 record count 범위를 확장한다.
- 개인 항목이 필요하면 `daily_items.owner_user_id`를 추가한다.
- 반복 주기는 별도 schedules 테이블로 추가한다.

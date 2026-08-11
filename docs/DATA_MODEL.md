# 데이터 모델

운영 DB에는 `database/migrations`의 SQL을 번호 순으로 적용한다. 최신 구조는 `0003_spaces_and_goal_types.sql` 기준이다.

## 관계

```text
auth.users 1─1 profiles
profiles 1─1 personal spaces
profiles N─M shared spaces (household_members)
spaces 1─N daily_items 1─N daily_records
daily_items 1─0..1 goal_schedules
```

기존 테이블명은 운영 migration 호환성을 위해 유지한다. 앱에서는 Household를 Space, Daily Item을 Goal Item으로 취급한다.

## 핵심 규칙

- 모든 사용자에게 삭제되지 않는 개인 공간이 정확히 하나 존재한다.
- 공유 참여는 멤버십만 추가하며 개인 공간과 데이터를 변경하지 않는다.
- 공유 공간은 초기 UI에서 사용자당 하나, 구성원 최대 두 명이다.
- 탈퇴 시 공동 데이터는 유지하고 방장 탈퇴 시 권한을 이전한다. 마지막 구성원은 일반 탈퇴할 수 없다.
- 목표 유형은 `check | count | restraint | numeric`이다.
- 기록 고유 키는 `(item_id, recorded_by, record_date)`이며 공동 목표도 사용자별로 독립 기록한다.
- 억제 목표는 성공·실패·미입력을, 수치 목표는 최소·최대·범위 조건을 구분한다.
- 반복 일정은 매일, 특정 요일, 주 N회, 격주, 매월, 격월을 지원한다.
- 날짜와 일정 시간대는 `Asia/Seoul`이다.
- 항목 중단은 삭제 대신 `archived_at`을 사용한다.

## RLS

- 개인 공간은 소유자만 접근한다.
- 공유 공간 항목과 일정은 구성원만 접근한다.
- 공유 기록은 구성원이 조회할 수 있지만 변경은 `recorded_by` 본인만 가능하다.
- 공간 생성·가입·탈퇴는 transaction RPC만 사용한다.

# Goal Tracker 제품 계획

## 1. 제품 개요

부부가 여러 목표, 습관, 일상 항목을 함께 관리하고 날짜별 수행 내역을 기록하는 모바일 중심 웹 앱이다.

전통적인 목표 관리보다 일상 기록에 가까운 항목도 다루므로 기본 단위를 **Daily Item**으로 정의한다.

예시:

- 영양제 먹기
- 운동하기
- 지출 기록하기
- 아이에게 책 읽어주기
- 오늘의 기분 기록하기

## 2. 제품 원칙

- 앱을 열면 오늘 기록할 항목이 바로 보여야 한다.
- 한 사용자가 여러 Daily Item을 만들 수 있다.
- 과거 기록은 보존하고 필요한 경우 수정할 수 있다.
- 초기 버전은 작게 유지하되 하루 N회 및 다양한 반복 주기로 확장 가능해야 한다.
- 모든 일일 날짜 계산은 `Asia/Seoul`을 기준으로 한다.
- 모바일 사용성을 우선한다.

## 3. 기술 스택

- 프레임워크: Next.js App Router
- 언어 및 UI: React, TypeScript, Tailwind CSS
- 데이터 및 인증: Supabase PostgreSQL, Auth, Row Level Security
- 테스트: Vitest, React Testing Library, Playwright
- 패키지 매니저: pnpm
- 배포: Vercel, Supabase Cloud

1차에서는 저장소 인터페이스 뒤에 로컬 저장소를 사용한다. 1.1에서 UI와 도메인 로직을 유지한 채 Supabase 구현으로 교체하고 로컬 데이터를 서버로 이전한다.

## 4. 단계별 계획

현재 구현 범위는 사용자 결정에 따라 1차와 1.1차를 함께 진행한다. 환경변수가 없을 때는 로컬 미리보기 모드, Supabase 설정 후에는 카카오 로그인과 Household 공동 DB 모드로 동작한다.

### 4.1 1차: Daily 기록 MVP

#### 목표

여러 Daily Item을 만들고 날짜별로 항목당 최대 한 번 완료 처리할 수 있다.

#### 포함 범위

- Daily Item 생성 및 수정
- Daily Item 순서 변경
- Daily Item archive 및 복원
- 오늘 항목 목록
- 항목별 완료 및 완료 취소
- 이전 날짜 조회 및 기록 수정
- 오늘 전체 진행률
- 항목별 현재 연속 기록
- 브라우저 로컬 저장 및 복원
- 모바일 중심 반응형 UI

#### 주요 화면

##### 오늘

- 현재 날짜
- 완료 항목 수와 전체 항목 수
- 진행률
- Daily Item 목록
- 항목별 완료 토글
- 이전 날짜 이동
- 오늘로 돌아오기

미래 날짜에는 기록할 수 없게 하는 것을 기본 정책으로 한다.

##### 항목 관리

- 항목 추가
- 이름, 색상, 아이콘 설정
- 정렬 순서 변경
- 활성 항목 archive
- archive 항목 복원

##### 기록

- 최근 7일 수행 내역
- 항목별 현재 연속일
- 항목별 누적 완료 횟수

#### 초기 데이터 모델

```ts
type DailyItem = {
  id: string
  title: string
  color: string | null
  icon: string | null
  sortOrder: number
  isArchived: boolean
  createdAt: string
  archivedAt: string | null
}

type DailyRecord = {
  id: string
  itemId: string
  date: string // Asia/Seoul 기준 YYYY-MM-DD
  count: number // 1차 UI에서는 0 또는 1만 허용
  completedAt: string | null
}
```

논리적으로 `(itemId, date)`는 고유해야 한다. `count`를 미리 두되 1차 UI와 도메인 규칙에서는 0 또는 1만 허용한다.

#### 저장소 경계

UI가 저장 방식을 알지 않게 데이터 접근 인터페이스를 둔다.

```ts
interface GoalRepository {
  listItems(): Promise<DailyItem[]>
  createItem(input: CreateDailyItem): Promise<DailyItem>
  updateItem(id: string, input: UpdateDailyItem): Promise<DailyItem>
  archiveItem(id: string): Promise<void>
  listRecords(dateRange: DateRange): Promise<DailyRecord[]>
  setDailyCount(itemId: string, date: string, count: number): Promise<void>
}
```

#### 완료 기준

- 여러 항목을 생성, 수정, 정렬, archive할 수 있다.
- 오늘과 과거 날짜에 항목별 완료 여부를 기록할 수 있다.
- 항목 하나는 같은 날짜에 중복 완료되지 않는다.
- 새로고침하거나 브라우저를 다시 열어도 기록이 유지된다.
- 진행률과 연속 기록이 정확하다.
- 주요 화면이 일반적인 모바일 너비에서 가로 스크롤 없이 동작한다.
- lint, typecheck, 단위 테스트 및 핵심 E2E 테스트를 통과한다.

#### 제외 범위

- 로그인 및 서버 동기화
- 부부 초대와 공유
- 하루 2회 이상 기록
- Daily 이외의 반복 규칙
- 알림
- 소셜 기능
- 상세 통계 및 데이터 내보내기

### 4.2 1.1차: 카카오 로그인 및 DB 연결

#### 목표

카카오 계정으로 로그인하고 부부가 공유 공간에서 여러 기기로 같은 항목과 기록을 사용한다.

#### 포함 범위

- Supabase 카카오 OAuth
- 사용자 프로필
- Household 생성
- 초대 코드 또는 초대 링크
- Household 구성원 관리
- Supabase DB 동기화
- 로컬 데이터의 최초 서버 이전
- 사용자 및 Household 단위 RLS
- 로그아웃과 세션 복원

#### 서버 데이터 모델 초안

```text
profiles
- id: uuid, auth.users 참조
- nickname
- profile_image_url
- created_at

households
- id: uuid
- name
- invite_code
- created_by
- created_at

household_members
- household_id
- user_id
- role
- joined_at

daily_items
- id
- household_id
- owner_user_id nullable
- title
- color
- icon
- sort_order
- archived_at
- created_at

daily_records
- id
- item_id
- user_id
- date
- count
- completed_at
- created_at
- updated_at
```

`owner_user_id`가 있으면 개인 항목, 없으면 공동 항목으로 확장할 수 있다. 개인/공동 항목의 정확한 완료 판정 UX는 1.1 착수 전에 결정한다.

#### 보안 기준

- Household 구성원만 해당 Household의 항목과 기록을 읽고 변경할 수 있다.
- 사용자는 자신의 프로필만 수정할 수 있다.
- Supabase service role key는 서버 전용으로 사용한다.
- RLS 정책에 대한 DB 테스트 또는 재현 가능한 검증 절차를 둔다.

### 4.3 2차: 하루 N회 기록

#### 목표

항목별 일일 목표 횟수를 설정하고 하루 동안 여러 번 기록할 수 있다.

#### 포함 범위

- 항목별 `targetCount`
- 기록 횟수 증가 및 감소
- `현재 횟수 / 목표 횟수` 표시
- 목표 달성 여부 계산
- 1회 목표 항목은 기존 완료 토글 UX 유지

예시:

```text
물 마시기  5 / 8  [-] [+]
약 먹기    1 / 2  [-] [+]
운동하기   0 / 1      [완료]
```

목표 초과 기록을 허용할지는 2차 착수 전에 결정한다.

### 4.4 3차: 반복 주기 확장

#### 목표

Daily Item을 일반적인 반복 Item으로 확장한다.

#### 대상 반복 규칙

- 매일
- 특정 요일
- 일주일에 N회
- 격주
- 매월
- 격월

#### 스케줄 모델 초안

```text
schedules
- id
- item_id
- frequency: daily | weekly | monthly
- interval: 1 | 2
- days_of_week nullable
- target_count_per_period nullable
- day_of_month nullable
- starts_on
- timezone
```

`매주 월요일`과 `한 주 중 아무 때나 N회`는 달성 판정이 다르므로 별도 규칙으로 취급한다. 월말에 존재하지 않는 날짜 처리와 주 시작 요일은 3차 착수 전에 정책을 확정한다.

## 5. 개발 순서

1. Next.js 프로젝트 및 기본 품질 도구 설정
2. 공통 레이아웃과 모바일 내비게이션
3. Daily Item 도메인 모델과 로컬 저장소
4. 항목 관리 화면
5. 날짜별 완료 기록
6. 진행률과 연속 기록
7. 단위 테스트와 핵심 E2E 테스트
8. Supabase 프로젝트 및 migration
9. 카카오 로그인과 Household 공유
10. 하루 N회 기록
11. 반복 주기 확장

## 6. 착수 전 결정이 필요한 사항

다음 항목은 해당 단계에 들어갈 때 결정한다.

- 1차: 첫 화면의 상세 비주얼과 내비게이션 방식
- 1.1: 개인 항목과 공동 항목의 완료 판정
- 1.1: 초대 코드와 초대 링크 중 기본 방식
- 2차: 목표 횟수 초과 허용 여부
- 3차: 주 시작 요일과 월말 예외 처리

결정 전까지는 현재 단계 구현에 필요하지 않은 정책을 임의로 확정하지 않는다.

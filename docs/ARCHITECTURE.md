# 아키텍처

## 기술 구성

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Supabase PostgreSQL, Auth, Row Level Security
- Vercel + Supabase Cloud

Next.js 하나로 UI, 인증 콜백, 필요한 서버 로직을 처리한다. 현재 범위에서는 별도의 Java 백엔드와 ORM을 두지 않는다.

## 렌더링 경계

- Server Component를 기본으로 한다.
- 사용자 입력, 즉시 상태 변경, 브라우저 API가 필요한 경계에만 Client Component를 둔다.
- 도메인 규칙을 React 컴포넌트에 직접 넣지 않고 독립 함수나 모듈로 분리한다.
- 작은 앱에 불필요한 전역 상태 라이브러리를 추가하지 않는다.

## 데이터 접근

UI가 `localStorage` 또는 Supabase를 직접 호출하지 않게 저장소 인터페이스를 둔다.

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

- 1차: 로컬 저장소 구현
- 1.1차: 동일한 경계 아래 Supabase 구현 및 로컬 데이터 이전

현재 UI는 항목별 하루 0회 또는 1회만 제공한다. 저장소 메서드는 향후 하루 N회 기록을 위해 `count`를 사용한다.

## 날짜 정책

- 사용자 기준 시간대는 `Asia/Seoul`이다.
- 일일 날짜 키는 `YYYY-MM-DD` 형식이다.
- UTC 직렬화 과정에서 날짜 키가 달라지지 않게 날짜와 시각을 구분한다.
- 미래 날짜 기록은 1차에서 허용하지 않는다.

## 데이터 보존

- 항목 삭제는 기본적으로 archive 처리한다.
- archive된 항목의 과거 기록은 보존한다.
- DB 스키마 변경은 migration으로 관리한다.

## 인증과 보안

- 1.1차에서 Supabase Kakao OAuth를 사용한다.
- 사용자 데이터 테이블은 RLS를 활성화한다.
- Household 구성원만 해당 Household의 항목과 기록에 접근할 수 있어야 한다.
- service role key와 비밀 키를 클라이언트에 노출하지 않는다.

## 확장 기준

- 현재 단계에 필요하지 않은 기능을 미리 구현하지 않는다.
- 하루 N회와 반복 주기 확장을 막는 데이터 결합은 피한다.
- 재사용 가능성이 확인되기 전에는 범용 추상화를 만들지 않는다.

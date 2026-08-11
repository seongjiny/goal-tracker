# 아키텍처

## 기술 구성

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase PostgreSQL, Auth, RLS
- Vitest, Playwright
- Vercel, Supabase Cloud

## 코드 경계

- 인증 전후 진입은 Server Component에서 처리한다.
- 화면 상태와 브라우저 상호작용은 Client Component에 둔다.
- `GoalRepository`가 로컬 미리보기와 Supabase 데이터 접근을 추상화한다.
- 목표 달성 및 반복 일정 계산은 `src/lib/goals/domain.ts`의 순수 함수로 처리한다.
- 앱 컴포넌트는 DB 테이블을 직접 호출하지 않는다. 로그아웃만 인증 클라이언트를 직접 사용한다.

```text
GoalTrackerApp → GoalRepository → LocalStorage | Supabase/RLS
              → goal domain   → 달성·연속·반복 일정 계산
```

- 환경변수가 없으면 LocalGoalRepository 미리보기 모드로 동작한다.
- 환경변수가 있으면 Kakao OAuth와 SupabaseGoalRepository를 사용한다.
- 개발 환경의 `/?demo=1`은 Supabase 설정과 무관한 E2E용 미리보기다.
- service role key는 클라이언트에서 사용하지 않는다.

## 실패와 데이터 보존

- 저장 실패는 재시도 가능한 메시지로 표시한다.
- 정렬의 낙관적 변경은 실패 시 원래 상태로 복원한다.
- 개인 공간과 개인 데이터는 공유 가입·탈퇴에서 이동하거나 삭제하지 않는다.
- migration 전후 검증 SQL로 행 수, 고아 행, 중복 기록을 확인한다.

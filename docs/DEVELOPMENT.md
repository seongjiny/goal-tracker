# 개발 가이드

## 요구 환경

- Node.js 22 이상
- pnpm 11

pnpm이 없다면 최초 한 번 실행한다.

```powershell
corepack enable
corepack install
```

## 명령

```powershell
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

E2E는 개발 전용 `/?demo=1`과 Playwright의 모바일·데스크톱 프로젝트를 사용한다.

## 코드 기준

- TypeScript strict 설정을 유지한다.
- 불필요한 `any`를 사용하지 않는다.
- 기능 단위로 UI, 도메인 로직, 데이터 접근을 분리한다.
- 모바일을 우선하고 일반적인 모바일 너비에서 가로 스크롤이 생기지 않게 한다.
- 외부 웹 폰트처럼 빌드 시 네트워크를 요구하는 의존성을 기본값으로 두지 않는다.
- 새 의존성은 기존 도구로 해결하기 어려운 명확한 이유가 있을 때만 추가한다.

## 검증 기준

- 일반 코드 변경: lint, typecheck
- 화면 또는 빌드 설정 변경: lint, typecheck, build
- 도메인 로직 변경: 관련 단위 테스트
- 주요 사용자 흐름 변경: 관련 Playwright E2E 테스트
- DB 변경: migration과 RLS 정책 검토

우선 테스트 대상은 다음과 같다.

- `Asia/Seoul` 기준 날짜 계산
- 항목별 하루 1회 제약
- archive 후 과거 기록 보존
- 진행률과 연속 기록 계산

# Database 설정

실행 가능한 SQL은 `database/migrations`에서 순서대로 관리한다.

## 최초 적용

1. Supabase 프로젝트를 생성한다.
2. SQL Editor에서 `migrations/0001_initial.sql` 전체를 실행한다.
3. Authentication > URL Configuration에 앱 주소를 등록한다.
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
4. Kakao Developers에서 앱과 REST API 키, Client Secret을 만든다.
5. Kakao Login을 활성화하고 Supabase Dashboard에 표시되는 callback URL을 Kakao Redirect URI로 등록한다.
6. Supabase Authentication > Providers > Kakao에 REST API 키와 Client Secret을 입력한다.
7. 프로젝트 루트 `.env`의 Supabase URL과 publishable key를 입력한다. 기존 anon key를 사용한다면 `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 입력해도 된다.

Kakao 키는 앱 런타임에서 사용하지 않는다. `.env`의 Kakao 항목은 설정 체크리스트이며 실제 값은 Supabase Dashboard에만 저장해도 된다.

## 이후 변경

- 기존 migration을 수정하지 않고 새 번호의 SQL 파일을 추가한다.
- 테이블 변경 시 RLS 정책과 관련 RPC를 함께 검토한다.

현재 운영 DB에는 `0001_initial.sql`, `0002_personal_items.sql`, `0003_spaces_and_goal_types.sql` 순서로 실행한다. `0003` 전후에는 `database/verification`의 대응 SQL 결과를 저장하고 0행 조건을 확인한다.
- SQL Editor에서 운영 DB에 적용하기 전에 개발 프로젝트에서 검증한다.

## 공유 방식

- 첫 로그인 시 삭제되지 않는 개인 공간을 자동 생성한다.
- 우리 공간 생성자가 초대 코드를 배우자에게 전달한다.
- 배우자는 멤버십만 추가하며 개인 공간과 개인 데이터는 변경되지 않는다.
- 우리 공간 목표는 공동 관리하고 완료 기록은 사용자별로 독립 저장한다.

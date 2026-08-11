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

현재 운영 DB에는 `0001_initial.sql` 다음으로 `0002_personal_items.sql`을 실행한다. 이 migration부터 같은 Household에서도 항목과 기록이 소유자별로 분리된다.
- SQL Editor에서 운영 DB에 적용하기 전에 개발 프로젝트에서 검증한다.

## 공유 방식

- 첫 로그인 시 사용자 전용 Household가 자동 생성된다.
- 설정 화면의 초대 코드를 배우자에게 전달한다.
- 배우자가 코드로 참여하면 같은 Household를 사용하되 기존 개인 항목과 기록은 보존하여 이동한다.
- 항목과 완료 기록은 만든 사용자에게만 보이며 서로 독립적으로 관리한다.

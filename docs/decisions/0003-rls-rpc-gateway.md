# ADR-0003: 로그인 없는 격리 — RPC 게이트웨이 + 공유코드, Realtime은 Broadcast 신호

- **상태**: 채택 (2026-11-04)
- **맥락**: [ADR-0002](0002-tech-stack.md)가 "Supabase Auth 없이 공유 코드 + RLS로 커플 데이터를
  격리"로 정했고, [`docs/db/access-control-rls.md`](../db/access-control-rls.md)가 그 방향을 **RPC
  게이트웨이**(커플 테이블 직접 접근 차단, `security definer` 함수로만 접근)로 구체화하며 "함수
  시그니처·반환·에러·레이트리밋·코드 생성/재발급·Realtime 방식은 3단계 ADR로 확정"이라 플래그했다.
  핵심 긴장: **로그인이 없어 요청에 신뢰할 수 있는 커플 식별자가 없다.** 평범한 RLS 정책은 클라이언트가
  보낸 `share_code` 필터를 신뢰할 수 없고(아무 `couple_id`나 조회 가능), Supabase **Realtime의 Postgres
  Changes**도 anon 역할엔 커플별 스코프를 줄 수 없어 `using(true)`면 전 커플 행이 누수된다.
- **결정**: 커플 데이터 접근을 **공유코드를 인자로 받는 `security definer` RPC 게이트웨이**로 단일화하고,
  실시간 동기화는 **행 데이터를 흘리지 않는 Broadcast "변경 신호"** 로 구현한다.
  - **격리 2층**: 전역 참조 테이블(`area`·`seed_*`·`auspicious_day`)만 anon `select using(true)`.
    커플 테이블은 anon 직접 `select/insert/update/delete`를 **전부 revoke**, RPC로만 연다.
  - **공유코드(capability 키)**: 서버(`create_couple` RPC)가 `pgcrypto`의 `gen_random_bytes`로 생성한다.
    **96bit 엔트로피**(랜덤 12바이트 → hex 24자 소문자. Postgres `encode`가 base32 미지원이라 hex 채택),
    DB엔 원문 1개 컬럼(`couple.share_code unique`). 화면 표시는 클라이언트가 4자 그룹 하이픈으로
    포맷(저장/전송은 원문). 사람이 추측·브루트포스할 수 없는 값이므로 이것을 아는 두 사람이 동등하게
    전체를 읽고 쓴다(= `01` 명시 범위, 의도된 설계).
  - **읽기**: `get_couple_snapshot(p_share_code text) returns jsonb` — 그 커플의 전 테이블을 **한 번에**
    JSON 번들로 반환(커플 앱이라 행 수가 작아 v1은 단일 스냅샷이 단순·충분). 클라이언트는 TanStack
    Query로 캐싱한다. 데이터가 커지면 도메인별 스냅샷으로 분할(미래, 지금 불필요).
  - **쓰기**: **테이블별 write RPC**(`create_*`/`update_*`/`delete_*`)로 연다. 각 함수는 ① `p_share_code`로
    `couple_id`를 해소하고(없으면 예외), ② 그 `couple_id` 범위 안에서만 insert/update/delete 한다(수정·삭제는
    대상 행의 `couple_id` 일치를 반드시 재검증 — 공유코드 A로 커플 B의 행 id를 건드릴 수 없게). 이 ADR은
    **이 계약(패턴)만 확정**하고, 실제 테이블별 함수는 화면을 만드는 Phase 1~3에서 추가한다. Phase 0은
    `create_couple`·`get_couple_snapshot`만 둔다.
  - **에러 계약**: 공유코드 무효/미존재는 RPC가 **명시적 예외**(SQLSTATE로 구분, 예 `PGRST`/커스텀
    코드)로 던지고, 클라이언트는 이를 "온보딩으로" 분기 신호로 해석한다. 성공은 데이터(jsonb/행), 실패는
    예외로만 — 성공 응답에 `{error}`를 섞지 않는다.
  - **Realtime = Broadcast 신호**: 커플 테이블 각각에 `AFTER INSERT/UPDATE/DELETE` 트리거를 걸어
    `realtime.send()`로 **토픽 `couple:<share_code>`** 채널에 "바뀜" 신호(테이블명 정도의 최소 payload)만
    보낸다. 상대 기기는 그 토픽을 구독하다가 신호를 받으면 **TanStack Query 캐시를 무효화→스냅샷 재조회**
    한다(흐름도 03과 일치). 행 데이터는 채널로 흐르지 않고, 토픽명이 곧 공유코드(비밀)라 사실상 비공개
    채널이다. 어느 경로(상대 기기·SQL 콘솔)의 변경이든 트리거가 동일하게 신호를 쏜다.
  - **레이트리밋**: v1은 두지 않는다. 96bit 공유코드는 브루트포스가 비현실적이고 사용자가 2명뿐이라,
    무료 티어에 리밋 인프라를 올리는 비용이 이득을 넘어선다(감수한 트레이드오프).
  - **재발급**: 설정의 "코드 재발급"은 `couple.share_code`를 새 랜덤값으로 교체한다. 그 즉시 옛 코드를
    저장한 상대 기기는 다음 접근에서 무효 예외를 받아 재온보딩한다(초대 다시 공유). 복수 코드/만료
    테이블은 두지 않는다 — 1커플=1코드.
- **버린 안**:
  - **직접 테이블 접근 + RLS가 공유코드 필터**(ADR-0002 본문의 최초 상상) — 로그인이 없어 요청의
    `share_code`를 RLS가 신뢰할 방법이 없다. 세션 변수에 넣어도 anon이 임의 설정 가능해 격리가 깨진다.
    RPC `security definer`만이 "서버가 코드→couple_id를 해소"를 신뢰 경계 안에서 보장한다.
  - **Realtime Postgres Changes 직접 구독** — anon 역할에 커플별 RLS 스코프를 줄 수 없어 `using(true)`면
    전 커플 행이 모든 구독자에게 누수된다. 격리 모델과 양립 불가라 버렸다.
  - **폴링/포커스 재조회**(Realtime 미사용) — 인프라는 가장 단순하나 idle 폴링이 이벤트 기반보다 낭비
    요청이 많고 수~수십 초 지연이 생긴다. Broadcast 신호가 총 부하도 낮고 즉시 반영돼 버렸다(사용자
    확정 2026-11-04, 기능별 부하 비교 후).
  - **단일 범용 RPC `mutate(table, op, payload)` 디스패처** — 함수 수는 줄지만 동적 SQL이라 타입 안전·
    가독·주입 위험에서 테이블별 명시 함수보다 열등해 버렸다.
- **결과**:
  - 커플 데이터는 공유코드를 아는 사람만, RPC를 통해서만 접근한다. 공유코드가 유일한 열쇠다(의도된
    트레이드오프, `01` 범위와 일치).
  - **새 제약**: ① 모든 커플 데이터 접근은 RPC를 거친다 — 클라이언트에서 테이블을 직접 `from('...')`
    하지 않는다(`lib/rpc`가 유일 통로). ② 새 커플 테이블/컬럼을 추가하면 **스냅샷 함수·write RPC·
    Broadcast 트리거를 함께** 갱신해야 한다(세 곳 동기화). ③ 공유코드 재발급은 상대 기기 강제 재온보딩을
    유발한다(단일 코드 설계의 대가).
  - Realtime 설정은 Broadcast 채널 1종과 커플 테이블 트리거만 추가하면 된다(Postgres Changes 퍼블리케이션
    불필요). 무료 티어 한도(동시연결 200·메시지 200만/월)에 2기기 사용은 여유롭게 들어간다.

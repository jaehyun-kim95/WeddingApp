# 접근 통제 (RLS) — 로그인 없는 격리

[ADR-0002](../decisions/0002-tech-stack.md)에 따라 Supabase Auth를 쓰지 않는다. 로그인·세션·JWT 없이
공유 코드만으로 커플 데이터를 격리한다. 메커니즘은 **"공유 코드 = 비밀" + RPC 게이트웨이**다.

## 두 층의 정책

- **전역 참조 테이블**(`area` · `seed_checklist_item` · `seed_roadmap_step` · `auspicious_day`):
  anon `select using (true)`(공개 읽기), 쓰기 없음. 앱이 제공하는 참조 데이터이므로 누구나 읽어도 된다.

- **커플 범위 테이블**(couple_id를 가진 모든 테이블): anon에게 **직접 테이블 접근을 닫는다.**
  모든 읽기/쓰기는 `security definer` Postgres 함수(RPC)로만 연다. RPC는 인자로 받은 `share_code`로
  `couple`을 찾아 **그 `couple_id`의 행에만** 작동한다. 공유 코드를 모르면 어떤 커플 데이터에도 닿지 못한다.

- `couple.share_code`는 **길고 추측 불가능한 값**으로 생성한다(capability 키 역할). 코드를 아는 두
  사람(커플)은 동등하게 전체 데이터를 읽고 쓴다 — 이는 `01-requirements.md`가 명시한 범위
  (로그인 없음, 외부 사용자 없음, 접근 권한 제한 안 함)와 일치하는 **의도된** 설계다.

## 구체 설계 — [ADR-0003](../decisions/0003-rls-rpc-gateway.md)에서 확정됨

함수 계약·에러·레이트리밋·공유 코드 생성/재발급·Realtime 방식은 **ADR-0003**이 확정했다. 요지:
- **읽기**: `get_couple_snapshot(p_share_code)` 단일 RPC가 커플 전 테이블을 JSON 번들로 반환.
- **쓰기**: 테이블별 `create_*`/`update_*`/`delete_*` RPC(공유코드→couple_id 해소 후 그 범위만,
  수정·삭제는 대상 행 couple_id 재검증). 함수는 화면을 만드는 Phase에서 추가.
- **공유 코드**: 서버 생성 96bit base32(화면은 하이픈 포맷), 재발급 = 교체(1커플=1코드).
- **에러**: 코드 무효는 명시적 예외 → 클라이언트가 온보딩으로 분기.
- **Realtime**: 커플 테이블 트리거가 `realtime.send()`로 토픽 `couple:<share_code>`에 변경 신호만 보냄
  (행 데이터 비노출) → 상대 기기가 캐시 무효화·스냅샷 재조회. Postgres Changes 직접 구독은 누수라 미사용.

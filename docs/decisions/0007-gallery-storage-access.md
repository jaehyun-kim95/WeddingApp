# ADR-0007: 갤러리 Storage 접근 모델 — couple_id 경로 접두사 RLS, RPC 게이트웨이의 의도된 예외

- **상태**: 채택 (2026-11-13)
- **맥락**: ADR-0003(RLS RPC 게이트웨이)은 모든 테이블에 "anon 직접 접근 차단 + security-definer
  RPC만 통과" 패턴을 적용한다. 갤러리는 사진 바이너리를 Supabase Storage에 올려야 하는데, RPC
  (plpgsql 함수)는 바이너리 업로드를 받을 수 없다 — 클라이언트가 Storage REST API로 직접
  업로드해야 한다. 그런데 이 앱은 Auth가 없다(ADR-0002) — 서버가 없으니 요청마다 서명된 업로드
  URL을 발급해 줄 주체가 없고, Supabase Storage의 서명 URL 생성 로직은 Storage 서비스 내부
  비밀로 서명돼 순수 SQL 함수로 재현할 수 없다. 즉 "RPC가 유일한 게이트웨이"를 Storage에
  그대로 적용할 방법이 없다.
- **결정**: `photos` Storage 버킷을 만들고, 오브젝트 경로를 **`{couple.id}/{uuid}.{ext}`로 강제**한다.
  `storage.objects`의 RLS 정책은 "경로의 첫 세그먼트가 `couple` 테이블에 실제 존재하는 id인가"만
  검사한다(`insert`/`select`/`delete` 전부 동일 조건). 클라이언트는 Supabase Storage SDK로
  **직접** 업로드/다운로드/삭제하고, 사진 메타데이터(`photo` 행)만 기존 패턴대로 `create_photo`/
  `delete_photo` RPC로 쓴다. `couple.id`는 `get_couple_snapshot(share_code)`로 조회해야만 얻을 수
  있으므로, 이 경로를 쓰려면 사실상 유효한 share_code를 먼저 알아야 한다 — ADR-0002가 이미 받아들인
  "공유 코드를 아는 사람은 누구나 접근 가능" 트레이드오프와 같은 신뢰 수준이다.
- **버린 안**:
  - **RPC로 서명된 업로드 URL 발급** — Supabase Storage의 서명 URL은 Storage 서비스가 자체 비밀로
    서명하며, 이를 호출하려면 Edge Function이나 서버가 필요하다. 이 저장소는 Edge Function을 배포한
    적이 없고(`supabase/config.toml` 부재, CLI 링크 안 됨), 새 배포 파이프라인을 추가하는 비용이
    "둘이서만 쓰는 개인 프로젝트"에 맞지 않아 버렸다.
  - **버킷 전체 공개(RLS 없이 완전 개방)** — 구현이 가장 단순하지만, anon 키(앱 번들에 그대로
    들어있음)를 가진 누구나 couple_id를 추측해 맞히면 다른 커플의 사진을 덮어쓰거나 지울 수 있다.
    couple_id는 UUID라 추측 난이도는 share_code와 비슷하지만, "쓰기 전 최소한 존재 확인"이라는
    한 겹을 공짜로 얻을 수 있어 완전 개방보다 싸게 더 안전한 경로 접두사 검사를 택했다.
  - **Supabase Auth 익명 로그인 도입** — ADR-0002에서 이미 "로그인 개념 자체를 코드 어디에도
    두지 않는다"는 더 강한 요구로 기각된 안을 이번에만 되살리는 셈이라 일관성이 깨진다.
- **결과**: 갤러리는 이 저장소에서 **"테이블 접근은 전부 RPC로만"**(ADR-0003)의 유일한 예외다 —
  Storage 오브젝트 자체는 클라이언트가 Supabase Storage SDK로 직접 접근하고, 메타데이터 행만 RPC를
  거친다. 새로운 제약: couple.id가 노출되면(예: 네트워크 탭·로그) 그 값만으로 해당 커플 경로에 쓰기가
  가능하다 — share_code 노출과 동일한 수준의 리스크이며, `01-requirements.md`가 이미 받아들인
  범위(접근 권한 제한 안 함)와 일치한다. Storage 버킷·RLS 정책은 마이그레이션 SQL로 작성하되,
  기존 마이그레이션과 동일하게 **사용자가 Supabase 대시보드 SQL Editor에서 직접 실행**해야 적용된다.

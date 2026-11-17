# ADR-0009: 백업 가져오기 — 현재 커플로의 전체 교체(destructive replace)

- **상태**: 채택 (2026-11-17)
- **맥락**: 설정 화면에 "백업 내보내기/가져오기"가 필요하다(기기 교체·사고 대비·수동 스냅샷).
  내보내기는 `get_couple_snapshot`(ADR-0003, 읽기는 단일 스냅샷)을 JSON 파일로 저장하면 되지만,
  가져오기(복원)는 커플 범위 11개 테이블(couple·checklist_item·schedule_event·vendor·expense·
  expense_option·expense_split·payment·area_budget·guest·photo)에 걸쳐 데이터를 다시 써야 한다.
  이때 **현재 데이터와 백업 데이터를 어떻게 합칠 것인가**가 되돌리기 비싼 설계 결정이다. 기존 쓰기
  RPC는 테이블당 단건 create/update/delete뿐이고, 여러 행을 한 번에 넣는 선례는 `import_guests`
  (단일 테이블 append, 0006) 하나뿐이라 복원 전용 RPC를 새로 설계해야 한다.
- **결정**: 복원 = **현재 커플로의 전체 교체(destructive replace)**. 단일 `security definer` RPC
  `restore_couple_backup(p_share_code, p_bundle)`가 한 트랜잭션 안에서 ①`couple` 본체를 백업 값으로
  덮어쓰고(단 `id`·`share_code`·`created_at`은 현재 것 유지 — 접속 비밀과 격리 키를 백업이 바꾸면
  안 된다) ②현재 커플의 모든 자식 행을 FK 역순으로 삭제한 뒤 ③백업 행을 FK 정순으로 재삽입한다.
  재삽입 시 백업에 담긴 내부 UUID는 신뢰하지 않고 `gen_random_uuid()`로 새로 발급하며, 백업 내부의
  상대 관계(expense↔option/split/payment, expense↔vendor)는 old→new 매핑으로 재연결한다. 전역 참조
  `area`는 UUID가 환경마다 다를 수 있으므로 **백업에 `area_code`를 동봉**하고 복원 시 `area.code`로
  재해소한다(UUID 직접 신뢰 금지). `photo`는 메타데이터(storage_path 등)만 백업/복원하고 Storage의
  실제 이미지 바이너리는 범위 밖이다(ADR-0007 — Storage는 RPC 게이트웨이 밖, 별도 경로).
- **버린 안**:
  - **병합(append/upsert)** — 백업 행을 현재 데이터에 더하거나 덮어쓴다. 하지만 백업과 현재 행을
    짝지을 안정적인 자연키가 없다(이름·금액은 중복 가능, UUID는 환경 간 신뢰 불가). 매칭 키 없이
    append하면 복원할 때마다 체크리스트·지출·하객이 중복 누적되고, 분담/집계(ADR-0004·0005)가
    오염된다. "백업을 두 번 가져오면 데이터가 두 배"가 되는 비멱등 동작은 복구 도구로서 치명적이다.
  - **백업 UUID를 그대로 재사용(교체하되 id 보존)** — 매핑 로직이 빠져 단순해지지만, 같은 백업을
    서로 다른 커플(다른 share_code)에 복원할 때 UUID가 충돌하고, 전역 `area` UUID가 다른 환경에서
    FK가 깨진다. 새 UUID 발급 + area_code 재해소가 이식성을 보장한다.
- **결과**: 복원은 **현재 데이터를 영구 삭제**하므로 파괴적 행위다 — 가져오기 전 미리보기 모달에서
  테이블별 건수와 "기존 데이터를 모두 덮어씁니다" 경고를 보이고 명시적 확인을 받는다(Part B 공통
  규칙의 파괴적 행위 확인과 일치). 단일 트랜잭션이라 실패 시 전체 롤백되어 "반쯤 복원된" 상태가
  없다. 전체 교체라 **멱등**이다(같은 백업을 두 번 복원하면 UUID만 다르고 최종 상태는 동일). 새
  제약: ①`get_couple_snapshot`에 새 커플 테이블/컬럼이 추가되면 `restore_couple_backup`의 삭제·
  재삽입 목록도 함께 갱신해야 한다(스냅샷·write RPC·broadcast 트리거 3곳 동기화 규칙에 복원 RPC가
  더해진다). ②복원 시 대량 insert가 행별 broadcast 트리거를 대량 발화시키지만, 파트너 세션은 같은
  스냅샷 키를 무효화하므로 1회 재조회로 수렴한다(무해). ③백업 파일 포맷은 `schema_version`(정수)으로
  버전을 찍고 **현재+직전 1버전까지만** 읽어준다(`docs/db/README.md` 하위 호환 정책) — 그 외 버전은
  로드를 거부한다.

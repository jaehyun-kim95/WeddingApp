# DB 산출물 (데이터 설계 v1)

결혼 준비 앱의 데이터베이스 설계 산출물. 스택은 **Supabase(Postgres)** — 타입·제약은 Postgres 기준
([ADR-0002](../decisions/0002-tech-stack.md)). `docs/03-data-model.md`는 이 폴더를 가리키는 포인터다
(데이터 설계의 단일 출처는 여기).

## 산출물 목록

| 산출물 | 파일 | 담는 것 |
|---|---|---|
| ERD | [ERD.md](ERD.md) | 엔티티 관계도(mermaid) + 관계 설명 |
| 테이블 정의서 | [table-definitions.md](table-definitions.md) | 테이블별 필드·타입·제약·불변식·인덱스 |
| 코드 정의서 | [code-definitions.md](code-definitions.md) | 공통코드(enum) 그룹·코드값·명칭·사용처 |
| 접근 통제 설계 | [access-control-rls.md](access-control-rls.md) | 로그인 없는 격리(공유 코드 RPC 게이트웨이) |

**시각 검토본(렌더된 ERD + 코드 정의서)**: https://claude.ai/artifact/QLnL7pQHpZnipLwAsqKMSp

## 스키마 버전
현재 **v1.1** — v1(초판) + 비용 예산 저장소 추가(마이그레이션 0004).

## 설계 원칙 (이 모델이 따른 것)

- **모든 커플 데이터는 `couple_id`를 가진다.** 공유 코드로 격리되는 단위(ADR-0002). 전역 참조
  데이터(area·시드·길일)만 예외로 `couple_id`가 없다.
- **준비영역(area)은 enum이 아니라 테이블이다.** 하이브리드 정보구조의 축이고, `CLAUDE.md` §4
  "데이터-로직 분리 — 고정 규칙 N개로 하드코딩하지 않는다"를 따른다. 표준 6개를 시드로 넣되 FK로
  참조해, 나중에 영역 추가 시 스키마 변경이 필요 없게 한다. (사용자 승인 2026-11-03)
- **금액의 단일 원장은 `expense` 계열이다**(ADR-0001). 업체(vendor)는 정보만 — `quoted_price`는
  참고값이고 금액 소스가 아니다.
- **달력의 납부일·계약일은 중복 저장하지 않는다.** 일정 화면은 `payment.due_date`·`vendor.contract_date`를
  직접 조회해 표시한다. `schedule_event`로 복제하지 않는다(한 번 저장 원칙). (사용자 승인 2026-11-03)
- **분담은 3컬럼 고정이 아니라 행(payer, amount)으로** 저장한다 — 부담 주체가 늘어도 스키마 변경 없이
  확장 가능. (사용자 승인 2026-11-03) 단 Phase 1 분담 정산은 `payment.payer`(실납부)로 집계한다
  ([ADR-0004](../decisions/0004-settlement-from-payments.md)) — `expense_split`은 당분간 미사용.

## 마이그레이션 이력
| 버전 | 변경 | 하위 호환 |
|---|---|---|
| v1 | 초기 스키마(테이블 정의서 전체) | — |
| v1.1 | 0004: `couple.total_budget`·`payment.payer`·`area_budget` 테이블 추가(비용 예산) | default/nullable·신규 테이블 — 기존 행 보존 |

## 하위 호환 정책
- **DB 스키마**: Supabase 마이그레이션으로 관리. 컬럼 추가는 nullable 또는 default로(기존 행 보존).
  enum 값 추가는 허용, 제거·이름변경은 마이그레이션 + 데이터 이행 동반.
- **백업 파일**(설정 "백업 내보내기"): JSON에 `schema_version` 필드를 넣는다. "백업 가져오기"는
  **현재 버전과 그 직전 1개 버전**까지 읽어 준다(구버전은 로드 시 변환). 이 정책이 하위 호환 테스트의 근거다.

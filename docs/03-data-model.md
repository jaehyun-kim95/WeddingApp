# 데이터 모델

> **데이터 설계 산출물은 [`docs/db/`](db/) 폴더로 분리했다**(사용자 결정 2026-11-03 — DB 산출물을
> 한 폴더에서 관리). 이 문서는 문서 체계상 슬롯을 유지하는 포인터이며, 내용의 단일 출처는 `docs/db/`다.

| 산출물 | 위치 |
|---|---|
| 산출물 인덱스 · 스키마 버전 · 설계 원칙 · 마이그레이션 · 하위 호환 | [db/README.md](db/README.md) |
| ERD(엔티티 관계도) | [db/ERD.md](db/ERD.md) |
| 테이블 정의서 | [db/table-definitions.md](db/table-definitions.md) |
| 코드 정의서(공통코드) | [db/code-definitions.md](db/code-definitions.md) |
| 접근 통제(RLS, 로그인 없는 격리) | [db/access-control-rls.md](db/access-control-rls.md) |

스택·근거는 [ADR-0002](decisions/0002-tech-stack.md), 업체·비용 경계는 [ADR-0001](decisions/0001-cost-vendor-boundary.md).

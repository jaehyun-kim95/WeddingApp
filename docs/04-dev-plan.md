# 개발계획

> 여기엔 **순서와 판정 기준**, 그리고 빌드를 이끄는 **핵심 프로세스 흐름**을 쓴다. 설계 내용은 `01`~`03`,
> 완료 보고는 `reports/`에 쓴다. 디렉터리 구조·계층은 [`02-architecture.md`](02-architecture.md)가 단일 출처.

## Phase 개요

핵심(홈·일정·체크·비용)부터 완성하고 확장한다(`PRODUCT.md` 원칙 5). 각 Phase는 **검증 체크리스트를
전부 통과해야** 다음으로 간다.

| Phase | 목표 | 선행 조건 | 상태 |
|---|---|---|---|
| 0 | 개발 기반 — 디자인 토큰·공용 컴포넌트·네비 뼈대·Supabase 연결·공유코드 온보딩 | scaffold 완료 | ⬜ |
| 1 | 코어 화면 — 홈·일정·체크리스트·비용 (실데이터 CRUD) | Phase 0 | ⬜ |
| 2 | 정보/장부 — 업체·하객(엑셀 I/O)·갤러리(사진 업로드) | Phase 1 | ⬜ |
| 3 | 재조합·운영 — 준비영역 모아보기·설정·표준 시드·알림 | Phase 2 | ⬜ |
| 4 | 배포 — EAS 내부 배포 + GitHub 연동 OTA, 두 기기 실사용 | Phase 3 | ⬜ |

---

## Phase 0 — 개발 기반
**산출물**: 앱이 기기에서 5개 탭을 오가고(서브 화면 push 포함), 공유 코드로 Supabase에 접속해 빈
데이터를 읽어오는 상태. 디자인 토큰과 공용 컴포넌트가 DESIGN.md를 따른다.

- `constants/theme.ts`를 DESIGN.md 토큰(색·타이포 11단계·간격·반경 5단계)으로 교체.
- 공용 컴포넌트 프리미티브: `chip`·`meter`·`fab`·`list-row`·`switch`·`segmented`·`page-head` 등
  (DESIGN.md 규범, **터치 타겟 히트 영역 ≥24×24px** — `phase-2.md` 미검증 항목 해소).
- 네비 뼈대: `app/(tabs)/_layout.tsx`(NativeTabs 5개) + 루트 Stack에 서브 화면(areas·vendors·guests·
  gallery·settings) + `onboarding`. 네비게이션 모델은 CLAUDE.md 「네비게이션 모델」 준수.
- `lib/supabase.ts`(anon 클라) + `lib/rpc.ts`(공유코드 게이트웨이) + `lib/share-code.ts`(저장/로드) +
  `lib/query-client.ts`. Supabase 프로젝트 생성 + 스키마 v1 마이그레이션(`docs/db/`) 적용 + 시드 투입.
- `types/db.ts`: 03 데이터 모델 → TS 타입.
- **ADR-0003 작성**: RLS RPC 게이트웨이 함수 설계 확정(`docs/db/access-control-rls.md`가 플래그한 항목).

**검증 체크리스트** — 전부 통과해야 완료.
- [ ] `npx tsc --noEmit` 0에러 (교체한 실제 코드 기준 — scaffold 예제 제거 후)
- [ ] `npx expo-doctor` 통과
- [ ] 실기기/시뮬레이터에서 5개 탭 전환 + 서브 화면 push/back 동작(실측 — 스크린샷/영상)
- [ ] 온보딩에서 새 공유 코드 발급 → 저장 → 재실행 시 자동 접속 확인(실측)
- [ ] 공유 코드로 RPC 호출 시 그 커플 데이터만 반환, 틀린 코드는 0건 반환(실측 쿼리로 격리 검증)
- [ ] 공용 컴포넌트 터치 타겟 ≥24×24px (DOM/좌표 실측)

**완료 보고**: [reports/phase-0.md](reports/phase-0.md)

---

## Phase 1 — 코어 화면 (홈·일정·체크·비용)
**산출물**: 네 화면이 실데이터로 동작한다. 두 기기에서 같은 데이터가 실시간 동기화된다.

- 체크리스트: 영역 필터·완료 토글(낙관적)·추가/수정/삭제, 담당자 표기.
- 일정: 월간 캘린더(일정·마일스톤 + `payment.due_date`·`vendor.contract_date` 직접 조회 표시)·
  리스트 뷰, 날짜 미정 모드, 길일 표시(토글 연동).
- 비용: 지출 원장(기본+옵션→최종금액), 분담(행 저장), payment 실지출/약정 집계, 영역 소계.
- 홈: D-day·진행률·예산 소비율·다음 할 일·미니 캘린더 — 위 데이터의 집계 뷰.

**검증 체크리스트**
- [ ] `npx tsc --noEmit` 0에러
- [ ] 각 화면 CRUD(처음/중간/끝 경계 포함)가 기기에서 동작(실측)
- [ ] 두 기기(또는 두 세션)에서 한쪽 변경이 Realtime으로 반대쪽에 반영(실측)
- [ ] 비용 집계 불변식(최종금액=기본+옵션, 실지출=납부완료 합) 단위 테스트 통과
- [ ] 멱등성·보존성 테스트(두 번 실행·개수 보존) 통과

**완료 보고**: [reports/phase-1.md](reports/phase-1.md)

---

## Phase 2 — 정보/장부 (업체·하객·갤러리)
**산출물**: 업체 정보 관리, 하객 명단+축의금+엑셀 I/O, 갤러리 사진 업로드/분류.

- 업체: 영역별 후보/계약, 역할(스드메 하위), 계약 견적 참고값(금액 소스 아님 — ADR-0001).
- 하객: 측/관계 필터·그룹, 참석·축의금·식대, **엑셀 가져오기/내보내기(SheetJS + blob-util)**.
- 갤러리: 영역별 썸네일 그리드, 사진/영상 업로드(expo-image-picker → Supabase Storage),
  저장 위치 정책(ADR-0002 — 1GB 초과 시 외부 전환 결정 지점).

**검증 체크리스트**
- [ ] `npx tsc --noEmit` 0에러
- [ ] 업체·하객 CRUD + 필터/그룹 동작(실측)
- [ ] 엑셀 가져오기→미리보기→일괄 저장, 내보내기 왕복 무손실(병리 입력: 빈 행·누락 열 테스트 포함)
- [ ] 사진 업로드→Storage 저장→썸네일 표시, 영역 분류 동작(실측)

**완료 보고**: [reports/phase-2-dev.md](reports/phase-2-dev.md)

---

## Phase 3 — 재조합·운영 (모아보기·설정·시드·알림)
**산출물**: 준비영역 크로스컷 뷰, 설정 전반, 표준 시드 불러오기, 길일·납부 알림.

- 준비영역 모아보기(areas): 영역별 할일·일정·업체·비용·사진 집계 아코디언.
- 설정: 결혼 정보 편집·공유 코드 표시/재발급·백업 내보내기/가져오기(schema_version)·표시 토글.
- 표준 시드 불러오기: seed_* → 결혼일 역산 → couple 데이터로 복사.
- 알림: `expo-notifications`로 납부일 알림(토글 연동), 길일 표시.

**검증 체크리스트**
- [ ] `npx tsc --noEmit` 0에러
- [ ] 모아보기 집계 수치가 각 원본 화면과 일치(실측 대조)
- [ ] 시드 불러오기 멱등성(두 번 불러도 중복 안 생김) 테스트 통과
- [ ] 백업 내보내기→가져오기 왕복 + **직전 버전 백업 읽기**(하위 호환) 테스트 통과
- [ ] 납부일 알림이 due_date 기준으로 스케줄됨(실측)

**완료 보고**: [reports/phase-3.md](reports/phase-3.md)

---

## Phase 4 — 배포
**산출물**: 두 사람이 각자 폰에 설치해 실사용. git push로 OTA 반영.

- `eas.json`(production/preview 채널) + EAS Build 내부 배포(APK/ad-hoc iOS).
- EAS Workflows: GitHub `main` push → 자동 `eas update`.

**검증 체크리스트**
- [ ] `eas build --profile preview` 성공 → 설치 링크로 두 기기 설치(실측)
- [ ] `main` push → 두 기기에서 앱 재실행 시 변경 반영(실측 왕복)
- [ ] 성능 예산(02 「성능 예산」) 대비 실측치 보고(탭 전환·조회·등록)

**완료 보고**: [reports/phase-4.md](reports/phase-4.md)

---

## 핵심 프로세스 흐름

빌드를 이끄는 흐름(도식). 세부 저장 구조는 `docs/db/`, 화면 규칙은 `design/` 목업 참조.

### ① 최초 실행 — 공유 코드 온보딩/부트스트랩
```mermaid
flowchart TD
  A[앱 실행] --> B{로컬에 공유 코드 있나?}
  B -- 있음 --> C[RPC: 코드로 couple 조회]
  C --> D{유효?}
  D -- 예 --> H[홈: 데이터 로드]
  D -- 아니오 --> E
  B -- 없음 --> E[온보딩 화면]
  E --> F{새로 시작 / 기존 참여}
  F -- 새로 시작 --> G[RPC: 커플 생성·코드 발급]
  F -- 기존 참여 --> I[코드 입력 → RPC 검증]
  G --> J[로컬에 코드 저장]
  I --> J
  J --> H
```

### ② 등록/수정/삭제 — 낙관적 갱신(빠른 반응의 핵심)
```mermaid
flowchart TD
  A[사용자 입력 등록/삭제] --> B[TanStack Query mutation]
  B --> C[낙관적: 캐시 즉시 갱신 → UI 반영]
  C --> D[lib/rpc: 공유코드 주입 호출]
  D --> E[Supabase 반영]
  E --> F{성공?}
  F -- 예 --> G[캐시 확정 · Realtime이 상대 기기에 전파]
  F -- 아니오 --> H[캐시 롤백 + 에러 안내]
```

### ③ 실시간 동기화 — 두 기기 공유
```mermaid
flowchart LR
  A[상대 기기 변경] --> B[Supabase Realtime]
  B --> C[내 기기 구독 콜백]
  C --> D[해당 쿼리 캐시 무효화]
  D --> E[화면 자동 갱신]
```

### ④ 표준 시드 불러오기
```mermaid
flowchart TD
  A[설정: 표준 시드 불러오기] --> B[seed_checklist_item · seed_roadmap_step 조회]
  B --> C{결혼일 있나?}
  C -- 있음 --> D[로드맵: months_before로 날짜 계산]
  C -- 없음 --> E[로드맵: 날짜 미정으로 생성]
  D --> F[couple의 checklist_item·schedule_event로 복사]
  E --> F
  F --> G[캐시 갱신 · 멱등: 이미 있으면 건너뜀]
```

### ⑤ 비용 집계
```mermaid
flowchart TD
  A[expense 기본금액] --> C[최종금액 = 기본 + Σ옵션]
  B[expense_option 추가금] --> C
  C --> D[영역 소계 · 전체 약정]
  E[payment where is_paid] --> F[실지출 합]
  G[expense_split by payer] --> H[나/애인/양가 분담 정산]
  D --> I[비용 화면: 예산 대비 · 분담]
  F --> I
  H --> I
```

### ⑥ 배포 — git push → OTA 반영
```mermaid
flowchart LR
  A[코드 수정] --> B[git push main]
  B --> C[EAS Workflow 트리거]
  C --> D[eas update: 채널에 OTA 발행]
  D --> E[두 기기: 앱 재실행 시 자동 반영]
```

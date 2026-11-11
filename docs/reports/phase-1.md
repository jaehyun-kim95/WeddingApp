# Phase 1 — 코어 화면(홈·일정·체크리스트·비용) 완료 보고

네 화면을 네 번의 세로 슬라이스로 순차 구현했다(체크리스트→일정→비용→홈). 각 슬라이스는 같은
패턴(`features/<도메인>/` `api.ts`+`cache.ts`+`hooks.ts`+`components/`, 쓰기는 security-definer
RPC + 낙관적 캐시)을 재적용해, 뒤로 갈수록 설계·구현 속도가 빨라졌다. 홈은 새 테이블·RPC가
필요 없는 순수 집계 뷰라 가장 가벼웠다.

## 개발 내용

| 슬라이스 | 설계 스펙 | 핵심 |
|---|---|---|
| 체크리스트 | `docs/superpowers/specs/2026-11-06-phase1-checklist-slice-design.md` | 영역 필터·완료 토글·진행률 미터. 날짜 상태 칩(지남/오늘/예정) 패턴을 이후 슬라이스가 재사용 |
| 일정 | `docs/superpowers/specs/2026-11-08-phase1-schedule-slice-design.md` | 캘린더↔리스트 세그먼트, `CalendarPicker` 대체용 커스텀 `CalendarView`, 길일·D-day |
| 비용 | `docs/superpowers/specs/2026-11-10-phase1-budget-slice-design.md` + `2026-11-10-budget-dashboard-layout-design.md` | 커플 스키마 확장(`total_budget`·`area_budget`·`payment.payer`), 업체별 지출 묶음, 분담 정산 |
| 홈 | `docs/superpowers/specs/2026-11-11-phase1-home-slice-design.md` | 세 도메인 집계 — 통합 "다가오는 일정·할 일" 피드, D-day 센터피스, 전체 준비 진행·지출 진행률 미터, 미니 캘린더(읽기전용 `CalendarView` 재사용) |

마이그레이션: `0002_checklist_writes.sql`·`0003_schedule_writes.sql`·`0004_budget_writes.sql`·
`0005_payment_kind_interim.sql`. 홈은 새 마이그레이션 없음(기존 스냅샷·훅 재사용).

## 이슈

- **비용 슬라이스가 커플 스키마를 확장** — 예산 저장소가 데이터 모델에 없어 `total_budget`·
  `area_budget`·`payment.payer`를 추가하며 스냅샷 함수·브로드캐스트 트리거·`CoupleSnapshot` 타입
  3곳을 함께 고쳤다(체크리스트·일정은 "쓰기 RPC만 추가"로 끝났던 것과 다른 점).
- **실기기 피드백으로 세부 UX가 여러 차례 수정됨**(사용자 방침 — 2단계 승인은 구조/방향, 세부는
  3단계에서 실테스트 후 개선): 체크리스트 날짜 칩 색상, 캘린더 날짜 숫자 밀림(마커 슬롯 고정),
  비용 납부/잔금 모델(저장 안 하는 계산값으로 재정의), 지출 카드 아코디언화 등.
- **홈은 "다가오는"의 해석이 모호** — 체크리스트만/일정만/통합 3가지 안 중 브레인스토밍으로
  "체크리스트+일정 통합, 과거 포함"으로 확정(상세는 홈 슬라이스 설계 스펙).
- **홈 1차 구현 직후 UI 리뷰 3라운드** — impeccable 결정 목업(아티팩트)을 보여주고 번호로 선택받는
  방식으로 진행: ① 대시보드 범위(처음엔 마스트헤드+D-day+미터 전부를 흰 카드에 넣었다가, "범위가
  넓다"는 피드백으로 미터만 남기고 마스트헤드·D-day는 원래 목업처럼 카드 밖 배경 위로 되돌림) ②
  바로가기 버튼(52px 정사각 타일 → 34px "콤팩트 필"로 축소 + 밴드에 상하 헤어라인 추가) ③ "다가오는
  일정·할 일" 제목을 미니 캘린더 위로 올려 캘린더+리스트를 한 섹션으로 묶음 ④ 대시보드 라벨 "예산
  소비율"이 비용 화면과 같은 값(`spentRate`)인데 다른 이름을 써서 혼동 — "지출 진행률"로 라벨 통일.
  전부 되돌리기 쉬운 스타일링 수정이라 ADR 없이 CLAUDE.md 「현재 상태」만 갱신.

## 트러블슈팅

- **CalendarPicker/CalendarView를 순수 RN으로 새로 만든 이유** — OS/브라우저 네이티브 날짜 피커는
  "오늘" 표시를 디자인대로 커스터마이즈할 수 없어 폐기, 순수 RN 컴포넌트로 교체(일정 슬라이스).
- **`Animated.Value`는 `useState(() => new Animated.Value(...))` 지연 초기화 필수** — React
  Compiler 린트가 렌더 중 `useRef(...).current` 접근을 에러로 잡는다(파일 단위 린트로는 숨어
  있다가 `eslint src` 전체 실행에서 발견).
- **브라우저 자동화 스크린샷이 세션 중 간헐적으로 CDP 타임아웃** — 코드 문제가 아니라 CDP 연결
  플레이크니스. 새 탭을 만들어 재시도하거나, DOM/콘솔 텍스트 실측(`get_page_text`·`read_console_messages`)
  으로 우회해 로직·수치를 먼저 검증했다(홈 슬라이스 검증에서도 동일하게 우회).

## 사이드 이펙트 및 조치

- 홈 슬라이스에서 `features/checklist/index.ts`에 `CheckRow`, `features/schedule/index.ts`에
  `EventRow`·`CalendarView` export를 추가했다(기존 화면 동작은 변경 없음 — 추가 전용).
- `CalendarView`에 `readOnly?: boolean`(기본 false)을 추가했다 — `schedule.tsx`의 기존 호출은
  수정 없이 그대로 동작, 홈만 `readOnly` 전달.

## 검증 결과

- ✅ `npx tsc --noEmit` 0에러(전체 `src/`)
- ✅ `npx eslint src` 0에러
- ✅ `npm test` 117/117 통과(체크리스트·일정·비용·홈 `api.test`/`cache.test` 전부 — 병합·멱등성·
  보존성·병리 입력 포함)
- ✅ 네 화면 CRUD가 웹 프리뷰 실측으로 동작 확인(체크리스트·일정·비용은 이전 세션에 실사용 피드백
  다수 반영까지 거쳤고, 홈은 이번 세션에 체크 토글 낙관적 반영→진행률 동기화→원복까지 실측)
- ✅ 비용 집계 불변식(최종금액=기본+옵션, 실지출=납부완료 합) — budget `api.test.ts`
- ✅ 멱등성·보존성(원본 배열 불변, 중복 없는 재정렬) — 네 슬라이스 테스트 전반

## 미검증으로 남은 것

- **두 기기(또는 두 세션) Realtime 교차 반영** — Phase 0에서 브로드캐스트 채널 인프라 자체(공유
  코드별 채널 격리)는 실측 검증됐지만, 체크리스트·일정·비용·홈을 실제로 두 기기로 동시에 써보며
  한쪽 변경이 반대쪽에 반영되는지는 아직 확인되지 않았다(사용자 확인, 2026-11-11). 두 사람이 함께
  쓰기 시작하는 시점에 가장 먼저 검증할 것.
- **iOS 실기기** — Phase 0부터 Android Expo Go로만 확인, iOS는 Phase 3 운영에서 결정.

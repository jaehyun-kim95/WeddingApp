# HANDOFF

다음 세션이 이 프로젝트를 바로 이어받기 위한 진입점. **사실 자체는 여기 적지 않는다** — 최신 상태의
단일 출처는 언제나 `CLAUDE.md`다. 여기는 "어디부터 읽고 무엇을 먼저 할지"만 안내한다.

## 0. 한 줄 현황

**Phase 0(기반) 완료 + Phase 1(코어 화면) 진행 중** — **체크리스트 슬라이스 완료**(구현·검증·커밋·push
전부 끝, `main` 최신). 다음은 **일정(schedule) 화면** 실구현이다. 체크리스트가 쓰기 RPC·낙관적 캐시·
jest 테스트·CalendarPicker·TabBar 등 Phase 1 전 화면이 재사용할 패턴/컴포넌트를 전부 확립해 놨다.

## 1. 먼저 읽을 것 (이 순서로)

1. `CLAUDE.md`의 **「현재 상태」**, **「진행 현황」**, **「아키텍처」** — 지금 어디까지 됐고 다음에 뭘 할지 +
   RN 코드/Supabase **함정**(단일 출처). 「아키텍처」에 이번 체크리스트 작업에서 발견한 함정(Animated
   지연초기화 패턴, Fab 좌표계 버그, CalendarPicker 설계 이유, 커스텀 TabBar가 screenOptions 무력화)이
   전부 기록돼 있다 — 모르면 똑같은 데서 또 걸린다.
2. **체크리스트 슬라이스 = 다음 화면들의 템플릿**: `src/features/checklist/`(`api.ts` 셀렉터+쓰기·
   `cache.ts` 낙관적 캐시 리듀서·`hooks.ts` Query/Mutation·`components/`) 구조와
   `src/features/README.md`(도메인 파일 계약)를 먼저 보고, 일정/비용도 같은 모양으로 짠다.
3. **개발 계획**: `docs/04-dev-plan.md` Phase 1 — 체크·일정·비용·홈 네 화면이 **전부 끝나야** Phase 1
   완료(체크리스트 하나 끝났다고 체크박스를 켜지 않았다 — 화면 단위가 아니라 Phase 단위 게이트).
4. **결정 이유**: `docs/decisions/` — ADR-0001(비용·업체 경계)·0002(스택)·0003(RLS RPC 게이트웨이).
   커플 데이터는 전부 `src/lib/rpc`를 통해서만 접근, 쓰기 RPC는 `p_share_code`로 couple_id를
   서버에서 해소(클라이언트가 couple_id를 모름 — 격리 핵심).
5. **데이터**: `docs/db/`(ERD·테이블/코드 정의서). 스키마는 `supabase/migrations/0001_init.sql`(기반)
   + `0002_checklist_writes.sql`(체크리스트 쓰기 RPC, 적용 완료). 다음 쓰기 RPC는 `0003_*.sql`.
6. **화면 구현 시**: `DESIGN.md` + `design/schedule.html`(승인된 일정 화면 목업). 공용 컴포넌트는
   `src/components/ui/`에 이미 있다 — 특히 `CalendarPicker`(날짜 선택)·`Meter`(애니메이션)·`TabBar`·
   `Chip`(지남/오늘/예정 등 상태색)를 일정 화면이 바로 재사용할 수 있다.
7. **직전 작업 설계 스펙·계획**(체크리스트 슬라이스 — 패턴 참고용):
   `docs/superpowers/specs/2026-11-06-phase1-checklist-slice-design.md` +
   `docs/superpowers/plans/2026-11-06-phase1-checklist-slice.md`.

## 2. 다음 작업 — 일정(schedule) 화면 실구현

체크리스트와 **동일한 순서**로 진행하면 된다(검증된 패턴 재사용):
1. **설계 스펙 먼저**: brainstorming 스킬로 일정 화면 세로 슬라이스 스펙 작성(`docs/superpowers/specs/`),
   체크리스트 스펙을 템플릿으로 삼는다. 일정 고유 쟁점 — 캘린더/리스트 뷰 전환(이미 `Segmented` 컴포넌트
   있음), 날짜 미정 모드, 길일 표시(토글 연동, `auspicious_day` 전역 참조 테이블), `payment.due_date`·
   `vendor.contract_date` **직접 조회 표시**(일정 자체 테이블이 아닌 교차 참조 — ADR-0001 경계 유지,
   비용 데이터를 일정에 복제하지 않는다).
2. **쓰기 RPC**: `supabase/migrations/0003_schedule_writes.sql` — `create_schedule_event`/
   `update_schedule_event`/`delete_schedule_event`, 체크리스트의 `0002_checklist_writes.sql`을 그대로
   본뜬다(p_share_code로 couple_id 해소, PT401/PT404, grant to anon). **스냅샷 함수·Broadcast 트리거는
   이미 `schedule_event`를 포함**(0001) — 쓰기 RPC만 추가하면 된다.
3. **features/schedule/**: 이미 `api.ts`(셀렉터)·`hooks.ts`(읽기 훅)·`types.ts` 뼈대가 있다(Phase 0
   구조 작업에서 생성). 체크리스트처럼 `cache.ts`(낙관적 리듀서)·mutation 훅·`components/`를 채운다.
4. **jest 테스트**: 캘린더 그리드는 이미 `src/components/ui/calendar-grid.ts`(순수, 월 그리드 계산)가
   있다 — 일정 화면의 캘린더 뷰가 그대로 재사용 가능한지 먼저 확인(새로 안 만들어도 될 수 있다).
5. **화면 조립**: `design/schedule.html` 수치 이식. 체크리스트의 CRUD 폼(`checklist-form.tsx`) 구조를
   참고해 일정 추가/수정 폼을 만들되, 날짜는 `DateField`/`CalendarPicker`를 그대로 재사용.
6. **검증**: `npx tsc --noEmit` 0 · `npm test` · `npx eslint src` 0 · 브라우저 실측(CRUD 경계 + 실측
   가능하면 2세션 Realtime) — 체크리스트 완료 보고의 검증 항목을 그대로 체크리스트로 쓴다.

이후 **비용 → 홈** 순(홈은 세 도메인 위의 집계 뷰라 마지막). 네 화면이 전부 끝나면 `docs/04-dev-plan.md`
Phase 1 체크박스를 채우고 `docs/reports/phase-1.md` 작성 + `CLAUDE.md` 「진행 현황」 갱신.

## 3. 로컬에서 확인하는 법

**Expo 앱**: `npx expo start` → Metro. **실기기 QR은 `! npx expo start`(로그 캡처 모드)로는 안 뜬다** —
사용자가 직접 연 터미널 창에서 실행해야 한다(같은 Wi-Fi 아니면 `--tunnel ngrok`, 전역 ngrok이 Windows에서
안 잡히면 `npm install @expo/ngrok`으로 로컬 설치). 웹 프리뷰는 `npx expo start --web`.

- **브라우저 자동화로 검증할 때(claude-in-chrome)**:
  - 스크린샷(`computer screenshot`)과 DOM `.click()`이 **세션 중 간헐적으로 타임아웃/무반응**할 수 있다
    (CDP 연결 플레이크니스로 추정, 이번 세션에서 반복 관찰 — 코드 문제 아님). 증상이 나오면 **새 탭을
    새로 만들어(`tabs_create_mcp`) 재시도**하면 보통 풀린다.
  - RN Web의 `Pressable`은 DOM 요소의 `.click()`으로 안 눌리는 경우가 있다 — `computer` 툴의 실제 좌표
    클릭을 우선 쓰고, 그것도 막히면 `PointerEvent`/`MouseEvent`를 `pointerdown→mousedown→pointerup→
    mouseup→click` 순서로 직접 dispatch하는 JS 헬퍼가 더 안정적이었다.
  - **OS/브라우저 네이티브 팝업**(이전에 썼던 `<input type="date">`의 네이티브 캘린더 등)은 CDP
    스크린샷·접근성 트리로 전혀 못 본다 — 이게 바로 CalendarPicker를 커스텀으로 새로 만든 이유다.
    우리가 만든 `CalendarPicker`(순수 RN 모달)는 일반 DOM이라 스크린샷·클릭 다 된다.
  - Reanimated rAF 기반 애니메이션은 스크린샷 타임아웃을 유발할 수 있다 — 로직/좌표는 DOM 실측
    (`javascript_tool`의 `getBoundingClientRect`·`getComputedStyle`)으로 먼저 검증하고 육안 확인은
    나중/별도로 돌린다.
- **Supabase RPC/격리 재검증**: 프로젝트 루트에서 `@supabase/supabase-js`로 `.env` 키를 읽어 RPC를
  직접 호출하는 1회용 Node 스크립트(ESM, 루트에 둬야 node_modules 해소) — 체크리스트 쓰기 RPC 검증 때
  쓴 패턴 그대로 재사용 가능. **검증 끝나면 스크립트와 테스트 커플 삭제**(임시 계측 제거 원칙).

**디자인 목업**(`design/*.html`, 참조용): `file://`가 막히니 로컬 정적 서버 필요.

## 4. 열려 있는 질문 / 아직 정해지지 않은 것

- **갤러리 사진 원본 저장 위치** — Supabase Storage 무료 1GB(ADR-0002). Phase 2에서 1GB 근접 시 외부
  전환 결정. 지금 미정.
- **탭바 아이콘** — DESIGN.md "드로운 SVG" 방향 확정, 현재는 라벨 전용(커스텀 `TabBar`,
  `src/components/tab-bar.tsx`). 실제 아이콘 에셋은 미정 Phase에서.
- **실사용 배포 형태(독립 앱 빌드)** — 지금은 개발용 Expo Go로만 구동. Android는 EAS Build로 APK 무료
  생성이 유력, iOS는 Apple Developer 계정 제약. Phase 3 운영에서 결정.
- **세부 기능은 구현하며 개선** — UI 승인은 "구조/방향". 계산 로직·입력 폼·엣지 케이스는 실테스트 후
  개선(사용자 방침 — 체크리스트에서 날짜 상태 색·FAB 모양·캘린더 UX가 실사용 피드백으로 여러 차례
  다듬어진 선례가 있다. 일정 화면도 1차 구현 후 비슷한 피드백 루프를 예상할 것).
- **준비 로드맵 위젯** — 사용 안함 보류. `system.css`의 `.roadmap`/`.rstep`은 남겨둠. 임의 재배치 금지.

## 5. 이 문서 자체에 대해

HANDOFF.md는 **얼리지 않는다** — `CLAUDE.md`의 「현재 상태」가 바뀔 때마다 위 0·2·4번을 그 자리에서
고쳐 쓴다(지난 세션 기록을 덧붙이지 않는다). 사실이 어긋나면 `CLAUDE.md`가 이긴다.

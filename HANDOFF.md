# HANDOFF

다음 세션이 이 프로젝트를 바로 이어받기 위한 진입점. **사실 자체는 여기 적지 않는다** — 최신 상태의
단일 출처는 언제나 `CLAUDE.md`다. 여기는 "어디부터 읽고 무엇을 먼저 할지"만 안내한다.

## 0. 한 줄 현황

**Phase 0(기반) 완료 + Phase 1(코어 화면) 진행 중** — **체크리스트·일정 슬라이스 완료**(구현·검증·
리뷰 전부 끝). 다음은 **비용(budget) 화면** 실구현이다. 체크리스트·일정이 쓰기 RPC·낙관적 캐시·
jest 테스트·공용 컴포넌트 재사용 패턴을 전부 확립해 놨다.

## 1. 먼저 읽을 것 (이 순서로)

1. `CLAUDE.md`의 **「현재 상태」**, **「진행 현황」**, **「아키텍처」** — 지금 어디까지 됐고 다음에 뭘 할지 +
   RN 코드/Supabase **함정**(단일 출처). 「아키텍처」에 체크리스트·일정 작업에서 발견한 함정(Animated
   지연초기화 패턴, Fab 좌표계 버그, CalendarPicker 설계 이유, 커스텀 TabBar가 screenOptions 무력화)이
   전부 기록돼 있다 — 모르면 똑같은 데서 또 걸린다.
2. **체크리스트·일정 슬라이스 = 다음 화면들의 템플릿**: `src/features/checklist/`·`src/features/schedule/`
   (`api.ts` 셀렉터+쓰기·`cache.ts` 낙관적 캐시 리듀서·`hooks.ts` Query/Mutation·`components/`) 구조와
   `src/features/README.md`(도메인 파일 계약)를 먼저 보고, 비용도 같은 모양으로 짠다. 날짜 선택은
   `src/components/ui/date-field.tsx`(두 슬라이스 공유 — 체크리스트 전용 폴더에서 공용 계층으로 이동됨).
3. **개발 계획**: `docs/04-dev-plan.md` Phase 1 — 체크·일정·비용·홈 네 화면이 **전부 끝나야** Phase 1
   완료(화면 단위가 아니라 Phase 단위 게이트).
4. **결정 이유**: `docs/decisions/` — **ADR-0001(비용·업체 경계, 비용 화면이 바로 이 경계 위에 섬)**·
   0002(스택)·0003(RLS RPC 게이트웨이). 커플 데이터는 전부 `src/lib/rpc`를 통해서만 접근, 쓰기 RPC는
   `p_share_code`로 couple_id를 서버에서 해소(클라이언트가 couple_id를 모름 — 격리 핵심).
5. **데이터**: `docs/db/`(ERD·테이블/코드 정의서). 스키마는 `supabase/migrations/0001_init.sql`(기반)
   + `0002_checklist_writes.sql` + `0003_schedule_writes.sql`(둘 다 적용 완료). 다음 쓰기 RPC는
   `0004_*.sql`(비용: expense·expense_option·expense_split·payment 4테이블 — 체크리스트/일정보다
   테이블 수가 많다, RPC 개수도 비례해 늘 것).
6. **화면 구현 시**: `DESIGN.md` + `design/budget.html`(승인된 비용 화면 목업). 공용 컴포넌트는
   `src/components/ui/`에 이미 있다 — `Meter`(예산 소비율)·`Chip`·`Segmented` 등 재사용 가능.
7. **직전 작업 설계 스펙·계획**(일정 슬라이스 — 패턴 참고용):
   `docs/superpowers/specs/2026-11-08-phase1-schedule-slice-design.md` +
   `docs/superpowers/plans/2026-11-08-phase1-schedule-slice.md` (체크리스트 슬라이스 원본은
   `docs/superpowers/specs/2026-11-06-*`·`docs/superpowers/plans/2026-11-06-*`).

## 2. 다음 작업 — 비용(budget) 화면 실구현

체크리스트·일정과 **동일한 순서**로 진행하면 된다(검증된 패턴 재사용). 비용은 앞 두 슬라이스보다
**데이터 모델이 복잡**하다(단일 테이블이 아니라 expense·expense_option·expense_split·payment 4개가
얽힘) — 설계 스펙 단계에서 이 구조를 먼저 분명히 할 것:
1. **설계 스펙 먼저**: brainstorming 스킬로 비용 화면 세로 슬라이스 스펙 작성(`docs/superpowers/specs/`),
   일정 스펙을 템플릿으로 삼는다. 비용 고유 쟁점 — **ADR-0001 경계**(비용=지출의 단일 원장, 업체=정보
   관리 전용·금액 소스 아님) 재확인, 업체별 묶음 구조(기본 견적 + 옵션 → 최종금액), 예산/약정/잔여
   집계 + 소비율 미터, 분담 정산(나/애인/양가 — **One-Axis Color Rule**: 중립 웜그레이 미터, 색은
   예산 상태에만), 업체 없는 직접 지출도 있음.
2. **쓰기 RPC**: `supabase/migrations/0004_budget_writes.sql` — expense/expense_option/expense_split/
   payment 각각의 CRUD, `0002`·`0003`과 동일 패턴(p_share_code로 couple_id 해소, PT401/PT404,
   grant to anon). **스냅샷 함수·Broadcast 트리거는 이미 4테이블 전부 포함**(0001) — 쓰기 RPC만 추가.
3. **features/budget/**: 이미 뼈대가 있는지 확인(Phase 0 구조 작업에서 다른 도메인처럼 생성됐을 수
   있음 — 없으면 체크리스트/일정과 동일하게 `api.ts`+`cache.ts`+`hooks.ts`+`index.ts`부터 만든다).
4. **jest 테스트**: 예산 집계(약정=기본+옵션 최종금액 합, 잔여=예산-약정, 소비율) 같은 계산 로직이
   순수 셀렉터 단위 테스트의 핵심 대상이 될 것 — 일정의 `selectDDay`/`selectAgenda`처럼.
5. **화면 조립**: `design/budget.html` 수치 이식. 체크리스트/일정의 CRUD 폼 구조를 참고.
6. **검증**: `npx tsc --noEmit` 0 · `npm test` · `npx eslint src` 0 · 브라우저 실측(CRUD 경계 + 실측
   가능하면 2세션 Realtime) — 일정 슬라이스 완료 시 쓴 검증 항목을 그대로 체크리스트로 쓴다.

이후 **홈**(네 도메인 위의 집계 뷰라 마지막). 네 화면이 전부 끝나면 `docs/04-dev-plan.md` Phase 1
체크박스를 채우고 `docs/reports/phase-1.md` 작성 + `CLAUDE.md` 「진행 현황」 갱신.

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
  직접 호출하는 1회용 Node 스크립트(ESM, 루트에 둬야 node_modules 해소, `node --env-file=.env
  스크립트.mjs`로 dotenv 패키지 없이 바로 실행 가능 — Node 20+) — 체크리스트·일정 쓰기 RPC 검증 때
  쓴 패턴 그대로 재사용 가능. **검증 끝나면 스크립트와 테스트 데이터 삭제**(임시 계측 제거 원칙).
- **브라우저의 `localStorage.wedding.shareCode`가 이전 세션의 낡은/무효 코드로 남아있을 수 있다**:
  일정 슬라이스 검증 중 실제로 겪음 — 브라우저가 들고 있던 코드가 PT401(무효)이라 CRUD가 **에러 없이
  조용히 실패**(onError가 콘솔에 아무것도 안 찍고 그냥 롤백만 함)했다. 증상: 화면은 멀쩡히 뜨는데
  couple sub/D-day가 안 보이고, 저장해도 반영이 안 됨. 진단: `javascript_tool`로
  `localStorage.getItem('wedding.shareCode')` 찍어서 Node 스크립트로 그 코드가 실제로 유효한지
  먼저 확인한다. 고치는 법: `localStorage.setItem('wedding.shareCode', '<유효한 코드>')` 후 새로고침.
- **낙관적 반영 실패 롤백은 `window.fetch`를 임시로 패치해 유도할 수 있다**: 네트워크를 실제로 끊기
  어려운 브라우저 자동화 환경에서, 특정 RPC 엔드포인트 URL(`rpc/create_schedule_event` 등)만
  골라서 `Promise.reject`하도록 `window.fetch`를 감싸면 해당 mutation만 실패시켜 롤백을 실측할 수
  있다. **테스트 후 반드시 `window.fetch`를 원래 함수로 복원**(패치를 저장해 두고 되돌리기).

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
  다듬어진 선례가 있다. 비용 화면도 1차 구현 후 비슷한 피드백 루프를 예상할 것).
  **일정 슬라이스 폴리시 후보 — 일부는 사용자 실사용 피드백(2026-11-08)으로 이미 해결**: 날짜 마커를
  점(dot)에서 DESIGN.md가 정한 언더바(막대, pill)로, 시간 입력을 자유 텍스트에서 전용 `TimeField`/
  `TimePicker`(시/분 휠)로 교체 완료 — 수정 폼의 시간 필드도 이제 초 없이 `HH:MM`만 보인다. **남은
  후보**: `CalendarView`의 보이는 달 state가 `selectedDate` prop이 캘린더 바깥에서 바뀌어도 따라가지
  않음(지금은 캘린더 자신의 날짜 탭으로만 `selectedDate`가 바뀌어서 안 걸림 — 나중에 외부에서 날짜를
  점프시키는 기능이 생기면 `useEffect`로 동기화 필요).
- **준비 로드맵 위젯** — 사용 안함 보류. `system.css`의 `.roadmap`/`.rstep`은 남겨둠. 임의 재배치 금지.

## 5. 이 문서 자체에 대해

HANDOFF.md는 **얼리지 않는다** — `CLAUDE.md`의 「현재 상태」가 바뀔 때마다 위 0·2·4번을 그 자리에서
고쳐 쓴다(지난 세션 기록을 덧붙이지 않는다). 사실이 어긋나면 `CLAUDE.md`가 이긴다.

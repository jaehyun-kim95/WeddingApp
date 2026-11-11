# Phase 1 네 번째(마지막) 슬라이스 — 홈 화면 (설계 스펙)

작성일: 2026-11-11 · 상태: 승인됨(사용자) · 범위: Phase 1의 네 번째 세로 슬라이스(마지막)

## 왜 이 문서인가 (Context)

체크리스트·일정·비용 세 슬라이스가 끝나 Phase 1의 마지막 화면만 남았다. 홈은 새 테이블·새 쓰기
RPC가 필요 없는 **집계 뷰**다 — 세 도메인의 기존 셀렉터·훅·컴포넌트를 조립하는 작업이 중심이고,
홈 고유 로직은 "체크리스트+일정 통합 피드" 하나뿐이다. `src/app/(tabs)/index.tsx`는 Phase 0
플레이스홀더("우리 결혼 준비" 텍스트) 그대로였다.

## 결정된 전제 (브레인스토밍 2026-11-11 — 바뀌면 이 문서부터 고친다)

1. **"다가오는 일정·할 일" 리스트 = 체크리스트(미완료) + 일정을 날짜순으로 통합**한 상위 N개(기본
   4). 체크리스트만 보여주는 안, 일정만 보여주는 안을 모두 제외 — 목업의 "일정·할 일"이라는 이름이
   둘 다를 가리킨다는 해석.
2. **통합 리스트의 체크리스트 항목은 홈에서 체크박스 바로 토글**(`useToggleChecklistItem` 재사용).
   읽기 전용 미리보기 안은 제외 — "홈에서 바로 처리하고 싶다"는 사용자 의도.
3. **과거(지남) 항목도 포함**한다. "다가오는"이라는 이름이 미래만을 뜻하는 것처럼 보이지만, 지남
   칩이 이미 경고를 나르고, 놓치면 안 되는 할 일을 홈에서 가리면 안 된다는 결정.
4. **예산 소비율 미터 = `spentRate`**(실지출÷약정) — 비용 대시보드 메인 지표와 동일 기준. 목업의
   `budgetRate`(약정÷예산)는 CLAUDE.md 2026-11-10 결정으로 참고자료로 격하됐으므로 홈 메인에도
   쓰지 않는다(목업을 그대로 베끼면 이미 뒤집힌 지표를 되살리는 셈이라 제외).
5. **미니 캘린더 = schedule의 `CalendarView`를 읽기 전용(`readOnly`) 모드로 재사용**. 홈 전용
   캘린더를 새로 만드는 안은 제외 — 로직 중복과 두 화면 UI가 조금씩 어긋날 위험.
   `readOnly`는 선택 링만 숨기고 날짜 탭은 그대로 두어, 탭하면 일정 탭으로 이동한다.
6. **바로가기 밴드는 아이콘 없이 라벨 전용**. `react-native-svg` 도입 안은 제외 — 탭바가 이미
   "아이콘 보류, 라벨 전용"이고 CLAUDE.md가 드로운 SVG 아이콘을 Phase 1 폴리시로 명시적으로
   이월해 둔 상태라, 홈만 아이콘을 들이면 일관성이 어긋나고 의존성·작업량이 늘어난다.
7. **마스트헤드 설정 톱니를 이번에 포함**(`/settings` push, `⚙` 글리프 최소 구현). 네비게이션
   모델상 홈 톱니가 설정 진입점이라, 미루면 설정으로 가는 길이 당분간 더보기 메뉴 하나뿐이 된다.

## 통합 피드 설계

- `HomeFeedItem` 판별 유니온(`{kind:'CHECKLIST', date, item: ChecklistItem}` |
  `{kind:'EVENT', date, item: TimelineItem}`) — 원본 행을 그대로 품어 렌더 시 기존
  `CheckRow`/`EventRow`에 바로 넘긴다. 홈은 새 행 UI를 만들지 않는다.
- `selectUpcomingFeed(snapshot, limit=4)`: 미완료 체크리스트 전부 + 일정 전부(완료 개념 없음)를
  날짜 오름차순 병합(날짜 미정은 맨 뒤), 상위 limit개. `today` 주입 없이 순수 — 상태 칩(지남/오늘/
  예정)은 각 행 컴포넌트가 자체 판정하므로 셀렉터는 필터링에 today가 필요 없다.
- `formatWeddingMeta(couple)`: 마스트헤드 메타 줄("2027. 5. 15 (토) 오후 1시 · 그랜드컨벤션
  그랜드홀")을 조합. `wedding_date_status==='UNDECIDED'`나 `wedding_date` 없으면 null.

## 산출물

- **신규 도메인** `src/features/home/`: `types.ts`·`api.ts`(`selectUpcomingFeed`·
  `formatWeddingMeta`)·`api.test.ts`(17케이스 — 병합·날짜순·null뒤로·limit·미완료필터·과거포함·
  시간 포맷 경계)·`hooks.ts`(`useUpcomingFeed`)·`index.ts`·
  `components/`(`masthead`·`dday-centerpiece`·`home-meters`·`quick-nav`).
- **배럴 보강**(최소 변경, 기존 동작 불변): `features/checklist/index.ts`에 `CheckRow`,
  `features/schedule/index.ts`에 `EventRow`·`CalendarView` export 추가 — 홈이 재사용.
- **`CalendarView`에 `readOnly?: boolean`(기본 false)**: 선택 링만 숨기고 `onSelectDate`는 그대로
  호출(탭 이동 유지). `schedule.tsx`의 기존 호출은 수정 없이 그대로 동작.
- **`src/app/(tabs)/index.tsx` 전면 교체**: 마스트헤드+D-day 센터피스+진행률/소비율 미터+바로가기
  밴드+미니 캘린더+통합 리스트+"할 일 추가" 조립. 쓰기는 체크 토글 하나뿐(새 migration 없음).

## 검증 결과(요약 — 상세는 `docs/reports/phase-1.md`)

`npx tsc --noEmit` 0 · `npx eslint src` 0 · `npm test` 117/117 통과. 웹 프리뷰 실측: D-day 미정
패널·두 미터(체크리스트/비용 화면과 수치 일치 확인)·바로가기 7개 라우팅·미니 캘린더 렌더+날짜 탭
이동·통합 리스트(과거 항목 포함, 지남 칩)·체크 토글 낙관적 반영(토글 후 원복, 진행률 동기화
확인)·설정 톱니 이동.

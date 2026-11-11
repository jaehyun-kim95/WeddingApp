# 홈 화면 실구현 (Phase 1 마지막 슬라이스) — 실행 계획

## Context

Phase 1(코어 화면)의 네 화면 중 체크리스트·일정·비용은 실구현이 끝났고, **홈만 남았다**.
현재 `src/app/(tabs)/index.tsx`는 Phase 0 플레이스홀더("우리 결혼 준비" 텍스트)다. Phase 1은
네 화면이 **전부** 끝나야 완료되는 Phase 단위 게이트(`docs/04-dev-plan.md`)라, 홈을 끝내야
Phase 1을 닫고 보고서를 쓸 수 있다.

홈은 **세 도메인의 집계 뷰**다 — 쓰기 RPC가 거의 없고(체크 토글만 재사용), 기존 셀렉터·훅·
컴포넌트를 조립하는 작업이 중심이다. 그래서 새 migration·새 쓰기 RPC가 필요 없다. 승인된 목업은
`design/home.html`. 설계 전제는 `docs/superpowers/specs/2026-11-11-phase1-home-slice-design.md`
참고.

## 확정된 설계 결정

- **"다가오는 일정·할 일" 리스트 = 체크리스트(미완료) + 일정을 날짜순으로 통합**해 상위 N개.
- 리스트의 **체크리스트 항목은 홈에서 체크박스 바로 토글 가능**(`useToggleChecklistItem` 재사용).
- **예산 소비율 미터 = `spentRate`**(실지출÷약정, 비용 대시보드 메인 지표와 동일 기준).
- **미니 캘린더 = schedule의 `CalendarView` 재사용**(읽기 전용 모드 추가).
- **바로가기 밴드 타일은 아이콘 없이 라벨 전용**(`react-native-svg` 미도입).
- 통합 리스트는 **과거(지남) 항목도 포함**.
- 마스트헤드 **설정 톱니 포함**(`/settings` push, `⚙` 글리프 최소 구현).

## 구현

### 1. 새 도메인 `src/features/home/`
- `types.ts` — `HomeFeedItem` 판별 유니온(`CHECKLIST` | `EVENT`, 원본 행을 품는다).
- `api.ts`(순수) — `selectUpcomingFeed(snapshot, limit)`: 미완료 체크리스트+전체 일정을 날짜
  오름차순 병합(null은 뒤), 상위 limit. `formatWeddingMeta(couple)`: 마스트헤드 메타 줄 조합.
- `hooks.ts` — `useUpcomingFeed(limit)`.
- `index.ts` — 배럴.
- `api.test.ts` — 병합·날짜순·null뒤로·limit·미완료필터·과거포함·시간포맷 경계.

### 2. 재사용을 위한 기존 배럴 export 추가
- `features/checklist/index.ts` → `CheckRow` export.
- `features/schedule/index.ts` → `EventRow`, `CalendarView` export.

### 3. `CalendarView` 읽기 전용 모드
- `readOnly?: boolean`(기본 false). 선택 링만 숨기고 `onSelectDate`는 그대로 호출(탭하면 일정
  탭으로 이동) — 완전 비활성화하지 않는다.

### 4. 홈 전용 컴포넌트 `src/features/home/components/`
- `masthead.tsx` — 이름+메타+설정 톱니.
- `dday-centerpiece.tsx` — Display 66px D-day(미정/당일/과거 분기).
- `home-meters.tsx` — 진행률(sage)+소비율(blush) 미터 2개.
- `quick-nav.tsx` — 가로 스크롤 라벨 타일 밴드.

### 5. 화면 조립 `src/app/(tabs)/index.tsx`
위 컴포넌트 + 미니 캘린더 + 통합 리스트 + "할 일 추가" 버튼으로 조립.

## 검증
- `npx tsc --noEmit` 0 · `npx eslint src` 0 · `npm test` 통과.
- 브라우저 실측(`npx expo start --web`): D-day·두 미터·바로가기 라우팅·미니 캘린더 마커·통합
  리스트 날짜순·체크 토글 낙관적 반영.

## 실행 결과
전부 계획대로 구현·검증 완료. 상세 결과는 `docs/reports/phase-1.md`. 유일한 편차: Realtime
두 기기 교차 반영은 사용자 확인 결과 아직 실측된 적이 없어 미검증으로 남김(Phase 1 보고서에 기록).

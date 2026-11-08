# Phase 1 두 번째 슬라이스 — 일정 화면 (설계 스펙)

작성일: 2026-11-08 · 상태: 승인됨(사용자) · 범위: Phase 1의 두 번째 세로 슬라이스

## 왜 이 문서인가 (Context)

체크리스트 슬라이스(`2026-11-06-phase1-checklist-slice-design.md`)가 쓰기 RPC·낙관적 캐시·
jest 테스트·공용 컴포넌트 패턴을 확립했다. 이번 슬라이스는 **같은 패턴을 일정(schedule) 화면에
재적용**한다. `src/features/schedule/`에 이미 읽기 전용 뼈대(`api.ts`의 `selectSchedule`·
`hooks.ts`의 `useSchedule`·`types.ts`)가 있다 — 이번은 **쓰기 + 화면**을 채운다.

## 결정된 전제 (바뀌면 이 문서부터 고친다)

- **UI는 승인된 목업 이식**: `design/schedule.html`의 구조·수치를 RN으로 옮긴다. `DESIGN.md` 상속,
  새 비주얼 월드 금지. 공용 프리미티브(`CalendarPicker`·`Segmented`·`Chip`·`Meter`·`Fab`)를
  최대한 재사용한다.
- **비용·업체 교차 참조는 이번 슬라이스 범위 밖(사용자 결정 2026-11-08)**: 목업은 "웨딩홀 잔금 납부"
  (`payment.due_date`) 류를 일정 타임라인에 섞어 보여주지만, 비용·업체 화면이 아직 구현 전이라
  실제 참조 데이터가 없다. 이번은 **`schedule_event` CRUD만** 구현한다. 단 셀렉터는 나중에
  payment/vendor 항목을 합류시킬 수 있는 **통합 `TimelineItem` 타입**으로 설계해 둔다(병합 자체는
  비용 화면 완료 후 별도 폴리시 작업).
- **캘린더 뷰에서 날짜 탭 → 그 날짜 일정 표시(사용자 결정 2026-11-08)**: 목업은 정적 "오늘 일정"+
  "다가오는" 섹션이지만, 실구현은 날짜를 탭하면 하단 상세 리스트가 그 날짜로 바뀐다(기본 선택=오늘).
- **데이터는 수동 추가로 시작**: 표준 시드는 Phase 3. 빈 상태 UI 포함.
- **테스트는 jest-expo + 순수 로직 단위 테스트**: RPC 왕복은 실측, 회귀 자산은 순수 함수 단위 테스트.
- **읽기 = 단일 스냅샷 셀렉터**(ADR-0003): `useCoupleSnapshot` 위에 얹는다. 별도 조회 없음.

## 아키텍처 (ADR·구조 제약 — 그대로 따른다)

- 커플 테이블은 **security-definer RPC로만 접근**. 모든 쓰기 RPC는 `p_share_code`로 couple_id를
  서버에서 해소(클라이언트는 couple_id를 모름).
- `lib/rpc`가 `supabase.rpc()`의 유일 통로. `features/schedule/api.ts`는 lib/rpc를 호출(코어, RN 비의존).
- Broadcast 트리거(`trg_bc_schedule`)와 스냅샷 함수(`get_couple_snapshot`)는 이미 `schedule_event`를
  포함(0001). **쓰기 RPC만 추가** — 3곳 동기화 중 트리거·스냅샷은 불변.
- 길일(`auspicious_day`)·영역(`area`)은 전역 참조 테이블 — RPC 게이트웨이를 거치지 않고
  `supabase.from()` 직접 조회(ADR-0003 예외, `lib/reference.ts`에 이미 `getAreas` 선례).

## 산출물

### ① 쓰기 RPC — `supabase/migrations/0003_schedule_writes.sql`

3개 함수(체크리스트의 토글 없음 — 일정엔 완료 개념 없음). 공통: `language plpgsql ·
security definer · set search_path = public`, `p_share_code`로 couple 해소(PT401), `grant execute
... to anon`.

| RPC | 인자 | 동작 |
|---|---|---|
| `create_schedule_event` | `p_share_code, p_area_id, p_title, p_event_date, p_event_time, p_location, p_assignee, p_category` | insert 후 생성 행(jsonb) 반환 |
| `update_schedule_event` | `p_share_code, p_id, p_title, p_event_date, p_event_time, p_location, p_assignee, p_category` | 해당 couple의 행만 update, 반환 |
| `delete_schedule_event` | `p_share_code, p_id` | 해당 couple의 행만 delete |

- `p_area_id`는 nullable(목업 "청첩장 시안 미팅" 등은 영역 있지만, 범용 일정은 영역 없을 수 있음).
- 모든 쓰기는 `where couple_id = v.id and id = p_id`로 한정. `reminder_at`은 이번 범위 밖(아래
  「하지 않는 것」).

### ② RPC 래퍼 — `src/lib/rpc.ts`

타입드 래퍼 3개 추가(체크리스트 래퍼 옆). `createScheduleEvent(input): Promise<ScheduleEvent>` 등.

### ③ 전역 참조 — `src/lib/reference.ts` + `src/hooks/use-areas.ts` 패턴 복제

- `getAuspiciousDays(): Promise<AuspiciousDay[]>` — `auspicious_day` 테이블 전체(날짜 적어 페이징
  불필요) 직접 select.
- `useAuspiciousDays()` — `useAreas`와 동일하게 1h staleTime 캐시.

### ④ 도메인 로직 — `src/features/schedule/`

- `types.ts`: 기존 `ScheduleDay` 대신(또는 추가) **`TimelineItem`** 뷰 타입 — `{ id, date, title,
  sub, kind: 'EVENT' | 'PAYMENT' | 'VENDOR', category, href? }` 형태로, 지금은 `schedule_event`만
  매핑하지만 이후 payment/vendor 합류 시 같은 셀렉터 출력 모양을 쓸 수 있게 한다.
- `api.ts`:
  - 쓰기 함수 3개 구현(`createScheduleEvent`/`updateScheduleEvent`/`deleteScheduleEvent` — lib/rpc 호출).
  - `selectAgenda(snapshot): { date: string; items: TimelineItem[] }[]` — 날짜별 그룹, 오름차순,
    날짜 미정(`event_date === null`)은 맨 끝 별도 그룹("날짜 미정"). 지금은 schedule_events만 매핑.
  - `selectEventsOnDate(snapshot, date): ScheduleEvent[]` — 캘린더 날짜 탭 상세용.
  - `selectDDay(weddingDate: string | null, today: string): number | null` — 순수.
  - `selectEventStatusChip` — 체크리스트 `selectStatusChip`과 동일 모양(지남/오늘/예정), `today` 주입.
- **`cache.ts`(신규, 순수)**: `applyCreate`/`applyUpdate`/`applyDelete` — `schedule_events` 배열만
  불변 교체. 체크리스트 `cache.ts`와 동일 모양.
- `hooks.ts`: 기존 `useSchedule`에 mutation 훅 3개 추가. 체크리스트의 `useChecklistMutation` 공통
  배선(onMutate 낙관적 패치·onError 롤백·onSettled invalidate)을 **동일 구조로 재구현**(제네릭
  함수 자체를 공유 모듈로 뽑지는 않음 — 두 군데뿐이라 추상화 아직 이르다, YAGNI).
- `components/`(신규):
  - `calendar-view.tsx`: 월 그리드(`CalendarPicker`의 `calendar-grid.ts` 순수 로직 재사용 검토 —
    월 이동·그리드 계산은 동일하나 "선택 범위 없이 단일 날짜 탭"이라 CalendarPicker 그대로 쓰기보다
    **`calendar-grid.ts`의 `buildMonthGrid`/`shiftMonth`만 import해 일정 전용 뷰로 재조립**(다른 달
    빈 칸·오늘 표시 등 로직 재사용, 모달 UI는 재사용 안 함). 날짜 칸에 이벤트 점 마커(세이지=EVENT,
    테라코타=IMPORTANT) + 길일 표시 + 탭 핸들러.
  - `agenda-view.tsx`: 날짜 그룹 리스트(아젠다 뷰), `selectAgenda` 소비.
  - `event-row.tsx`: 일정 한 줄(제목·시간/장소·영역 칩·상태 칩).
  - `schedule-form.tsx`: 체크리스트 `checklist-form.tsx` 구조 복제 — 제목·날짜(`CalendarPicker`)·
    시간·장소·담당자·영역(선택)·분류(일정/중요 — `MILESTONE`은 시드 전용이라 폼에 비노출).

### ⑤ 화면 — `src/app/(tabs)/schedule.tsx`

5줄 플레이스홀더를 교체. `Segmented`로 캘린더/리스트 전환(로컬 state). 헤더: `PageHead` +
D-day(`selectDDay`, `couple.wedding_date_status`가 `UNDECIDED`면 D-day 숨기고 미정 안내 패널 노출
— `undated-note`를 RN으로). 캘린더 뷰: 월 그리드 + 선택 날짜(기본 오늘) 상세 리스트 + FAB. 리스트
뷰: 아젠다 전체 + FAB. 빈 상태(`schedule_events.length === 0`) UI 포함.

### ⑥ 테스트 — jest

- `features/schedule/*.test.ts`:
  - `selectAgenda`: 날짜 오름차순 그룹핑, 날짜 미정 그룹 맨 뒤, 원본 불변.
  - `selectEventsOnDate`: 해당 날짜만 필터, 없으면 빈 배열.
  - `selectDDay`: 미래/오늘/과거/null(미정) 네 케이스.
  - `selectEventStatusChip`: 체크리스트와 동일한 지남/오늘/예정 경계값.
  - `cache.ts` 리듀서: 추가/수정/삭제 각각 — 멱등성, 보존성(대상 외 항목 불변), 병리 입력(빈 목록,
    존재하지 않는 id).

## 유닛 경계 (각각 독립 이해·테스트 가능)

| 유닛 | 하는 일 | 의존 |
|---|---|---|
| `0003_*.sql` RPC | couple 격리 하 일정 쓰기 | couple/area 테이블·제약 |
| `lib/rpc` 래퍼(일정분) | RPC 호출을 타입드 함수로 | supabase·types/db |
| `lib/reference.ts`(길일분) | 전역 참조 직접 조회 | supabase |
| `features/schedule/cache.ts` | 스냅샷 불변 패치(순수) | types/db only |
| `features/schedule/api.ts` | 도메인 읽기·쓰기(코어) | lib/rpc |
| `features/schedule/hooks.ts` | Query/Mutation 배선 | couple/hooks·api·cache·keys |
| `features/schedule/components` | 화면 전용 UI | components/ui·hooks |
| `app/(tabs)/schedule.tsx` | 조립 | features/schedule |

## 하지 않는 것 (경계)

- **비용·업체 교차 참조**(payment.due_date·vendor.contract_date를 타임라인에 병합) — 비용 화면
  완료 후 별도 작업.
- **알림(`reminder_at`)** — 푸시 인프라 없음. 컬럼은 스키마에 있지만 폼·쓰기 RPC에서 다루지 않는다.
- **`MILESTONE` 분류 폼 노출** — 시드 전용으로 남김(Phase 3).
- 비용·홈 화면(다음 슬라이스). 표준 시드 불러오기(Phase 3).
- 커플 테이블/컬럼·스냅샷 함수·트리거 변경(이번은 쓰기 RPC만).
- Supabase 통합 테스트(RPC 왕복은 실측으로 갈음).

## 검증 (완료 판정)

- `npx tsc --noEmit` 0에러 · `npm test` 통과 · `npx eslint src` 0건.
- 웹/기기에서 CRUD **경계 포함** 실측: 빈 목록에서 첫 추가 / 중간 항목 수정 / 마지막 삭제 / 날짜
  미정 항목 추가.
- 캘린더 뷰: 날짜 탭 시 하단 상세가 바뀌는지, 월 이동, 이벤트 마커·길일 표시 실측.
- 두 세션(웹+기기 또는 두 탭)에서 한쪽 변경이 Realtime으로 반대쪽 반영 실측.
- 낙관적 반영 즉시성 + 실패 롤백 1건 실측.
- `wedding_date_status = UNDECIDED`일 때 D-day 대신 미정 안내 패널이 뜨는지 실측.

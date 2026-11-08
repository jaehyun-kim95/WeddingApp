# 일정(Schedule) 화면 — Phase 1 두 번째 슬라이스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/app/(tabs)/schedule.tsx`의 5줄 플레이스홀더를 캘린더/리스트 뷰 전환이 되는 실제 CRUD 화면으로 교체한다. 체크리스트 슬라이스가 확립한 쓰기 RPC·낙관적 캐시·jest 테스트 패턴을 그대로 재적용한다.

**Architecture:** `supabase/migrations/0003_schedule_writes.sql`(쓰기 RPC 3개) → `src/lib/rpc.ts`(타입드 래퍼) → `src/features/schedule/`(셀렉터·캐시·mutation 훅·컴포넌트) → `src/app/(tabs)/schedule.tsx`(조립). 비용·업체 교차 참조는 이번 범위 밖(디퍼) — `schedule_event` CRUD만 다룬다.

**Tech Stack:** Expo Router, TanStack Query, Supabase(RPC 게이트웨이), jest-expo.

**설계 스펙:** `docs/superpowers/specs/2026-11-08-phase1-schedule-slice-design.md`

---

## File Structure

| 파일 | 변경 | 책임 |
|---|---|---|
| `src/components/ui/date-field.tsx` | **이동**(←`features/checklist/components/`) | 날짜 입력 필드 — checklist·schedule 공용이므로 공용 UI 계층으로 승격 |
| `src/components/ui/index.ts` | 수정 | `DateField` export 추가 |
| `src/features/checklist/components/checklist-form.tsx` | 수정 | import 경로만 변경(DateField 이동 반영) |
| `src/types/db.ts` | 수정 | `AuspiciousDay` 타입 추가 |
| `src/lib/reference.ts` | 수정 | `getAuspiciousDays` 추가 |
| `src/hooks/use-auspicious-days.ts` | 신규 | 길일 참조 쿼리 훅(`use-areas.ts`와 동일 모양) |
| `supabase/migrations/0003_schedule_writes.sql` | 신규 | `create_schedule_event`/`update_schedule_event`/`delete_schedule_event` |
| `src/lib/rpc.ts` | 수정 | 위 3개 RPC 타입드 래퍼 |
| `src/features/schedule/types.ts` | 수정 | `TimelineItem`·`AgendaGroup`(구 `ScheduleDay` 대체) |
| `src/features/schedule/api.ts` | 수정 | 쓰기 함수 3개 + 셀렉터(`selectAgenda`·`selectEventsOnDate`·`selectMarkersByDate`·`selectDDay`·`selectEventStatusChip`·`toTimelineItem`) |
| `src/features/schedule/api.test.ts` | 신규 | 위 셀렉터 전부 단위 테스트 |
| `src/features/schedule/cache.ts` | 신규 | 낙관적 캐시 리듀서(`applyCreate`/`applyUpdate`/`applyDelete`) |
| `src/features/schedule/cache.test.ts` | 신규 | 리듀서 단위 테스트 |
| `src/features/schedule/hooks.ts` | 수정 | mutation 훅 3개 추가 |
| `src/features/schedule/index.ts` | 수정 | 배럴 갱신 |
| `src/features/schedule/components/event-row.tsx` | 신규 | 일정 한 줄(카테고리 점 + 제목/부제 + 상태 칩) |
| `src/features/schedule/components/agenda-view.tsx` | 신규 | 아젠다(리스트) 뷰 — 날짜 그룹 |
| `src/features/schedule/components/calendar-view.tsx` | 신규 | 월 그리드(날짜 탭 → 선택) + 이벤트 마커 + 길일 표시 |
| `src/features/schedule/components/schedule-form.tsx` | 신규 | 추가/수정 모달 |
| `src/app/(tabs)/schedule.tsx` | 수정 | 화면 조립 |

---

## Task 1: DateField를 공용 UI 계층으로 이동

체크리스트 전용 폴더에 있던 `DateField`를 일정 화면도 쓸 수 있게 `components/ui`로 옮긴다. 순수 UI(도메인 로직 없음)라 이동이 안전하다 — `features/README.md`의 "공용 프리미티브는 `@/components/ui` 재사용" 원칙을 따른다.

**Files:**
- Create: `src/components/ui/date-field.tsx`
- Delete: `src/features/checklist/components/date-field.tsx`
- Modify: `src/components/ui/index.ts`
- Modify: `src/features/checklist/components/checklist-form.tsx`

- [ ] **Step 1: 새 위치에 파일 생성(자기 참조 배럴 import를 상대 import로 교정)**

`src/components/ui/date-field.tsx` 생성:

```tsx
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { CalendarPicker } from './calendar-picker';
import { Text } from './text';

// 날짜 입력을 텍스트 타이핑이 아니라 커스텀 달력 선택(CalendarPicker)으로 받는다. 전에는 네이티브는
// @react-native-community/datetimepicker, 웹은 raw DOM <input type="date">로 플랫폼을 나눴지만, 둘 다
// OS/브라우저가 그리는 영역이라 "오늘" 표시를 우리 디자인대로 커스터마이즈할 수 없었다(실사용
// 피드백 — 연한 원으로 오늘을 표시해달라는 요청을 네이티브 피커로는 구현 불가). CalendarPicker는
// 순수 RN 컴포넌트라 플랫폼 구분 없이 동일하게 동작·스타일링된다.
// checklist·schedule 두 도메인이 공유하므로 components/ui(공용 계층)에 둔다.
export type DateFieldProps = {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
};

export function DateField({ value, onChange, placeholder }: DateFieldProps) {
  const [show, setShow] = useState(false);
  // 열 때마다 증가시켜 CalendarPicker를 리마운트한다 — visible만 토글하면 CalendarPicker 내부의
  // "보던 달" state가 전에 탐색하던 달에 멈춰 있어, 닫았다 다시 열면 오늘이 없는 엉뚱한 달이 보인다.
  const [calKey, setCalKey] = useState(0);
  const openCalendar = () => { setCalKey((k) => k + 1); setShow(true); };

  return (
    <>
      {/* 절대배치 "지우기"의 기준이 이 필드 자신이 되도록 relative 래퍼로 감싼다 — 감싸지 않으면
          RN이 더 바깥(모달 전체) 조상을 기준으로 위치를 잡아 엉뚱한 곳에 뜬다. */}
      <View style={{ position: 'relative' }}>
        <Pressable onPress={openCalendar} style={[inputStyle, value ? { paddingRight: 56 } : null]}>
          <Text variant="body" color={value ? 'ink' : 'inkFaint'}>{value ?? placeholder}</Text>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange(null)} style={{ position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Text variant="caption" color="inkMuted">지우기</Text>
          </Pressable>
        ) : null}
      </View>
      <CalendarPicker
        key={calKey}
        visible={show}
        value={value}
        onSelect={(d) => { onChange(d); setShow(false); }}
        onClose={() => setShow(false)}
      />
    </>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;
```

- [ ] **Step 2: 옛 파일 삭제**

```bash
rm src/features/checklist/components/date-field.tsx
```

- [ ] **Step 3: 배럴에 추가**

`src/components/ui/index.ts`에 한 줄 추가(파일 끝):

```ts
export { DateField, type DateFieldProps } from './date-field';
```

- [ ] **Step 4: checklist-form.tsx import 경로 교정**

`src/features/checklist/components/checklist-form.tsx` 상단 import 블록을 교체:

```tsx
import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Button, Chip, DateField, Segmented, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area, Assignee, ChecklistItem } from '@/types/db';
```

(기존 `import { DateField } from './date-field';` 줄은 삭제한다.)

- [ ] **Step 5: 타입체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```

Expected: 둘 다 0에러/통과(동작 변경 없는 순수 이동이므로 기존 테스트 영향 없음).

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/date-field.tsx src/components/ui/index.ts src/features/checklist/components/checklist-form.tsx src/features/checklist/components/date-field.tsx
git commit -m "$(cat <<'EOF'
refactor(ui): DateField를 components/ui로 이동 — checklist·schedule 공용

일정 화면도 날짜 선택이 필요해, 체크리스트 전용 폴더에 있던 순수 UI 컴포넌트를 공용 계층으로 승격.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 뷰 타입 + 셀렉터 + 캐시 리듀서 (순수 로직, TDD)

**Files:**
- Modify: `src/features/schedule/types.ts`
- Modify: `src/features/schedule/api.ts`
- Create: `src/features/schedule/api.test.ts`
- Create: `src/features/schedule/cache.ts`
- Create: `src/features/schedule/cache.test.ts`

- [ ] **Step 1: 뷰 타입 갱신**

`src/features/schedule/types.ts` 전체 교체:

```ts
import type { EventCategory } from '@/types/db';

// 뷰/파생 타입. 일정 화면은 캘린더(날짜별)와 리스트(아젠다) 두 뷰를 전환한다.
// TimelineItem은 지금은 schedule_event만 매핑하지만, 비용 화면 완료 후 payment.due_date·
// vendor.contract_date를 같은 모양으로 합류시킬 수 있게 kind로 출처를 구분해 둔다
// (사용자 결정 2026-11-08 — 교차 참조는 비용 화면 완료 후 별도 작업).
export type TimelineItem = {
  id: string;
  date: string | null; // YYYY-MM-DD, null = 날짜 미정
  title: string;
  sub: string | null; // "시간 · 장소" 조합(있는 것만)
  kind: 'EVENT';
  category: EventCategory;
  areaId: string | null;
};

export type AgendaGroup = {
  date: string | null; // null = "날짜 미정" 그룹(항상 맨 뒤)
  items: TimelineItem[];
};
```

- [ ] **Step 2: 셀렉터 테스트 작성(실패 유도)**

`src/features/schedule/api.test.ts` 신규 생성:

```ts
import type { CoupleSnapshot, ScheduleEvent } from '@/types/db';
import {
  selectAgenda, selectDDay, selectEventsOnDate, selectEventStatusChip,
  selectMarkersByDate, selectSchedule, toTimelineItem,
} from './api';

const ev = (id: string, date: string | null, opts: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id, created_at: '', couple_id: 'c1', area_id: null, title: id, event_date: date,
  event_time: null, location: null, assignee: null, category: 'EVENT', reminder_at: null, origin: 'USER',
  ...opts,
});

describe('selectSchedule', () => {
  test('날짜 오름차순, 날짜 미정은 뒤로, 원본 불변', () => {
    const snap = { schedule_events: [ev('b', '2026-12-01'), ev('a', null), ev('c', '2026-11-01')] } as CoupleSnapshot;
    const out = selectSchedule(snap);
    expect(out.map((e) => e.id)).toEqual(['c', 'b', 'a']);
    expect(snap.schedule_events.map((e) => e.id)).toEqual(['b', 'a', 'c']); // 원본 보존
  });
});

describe('toTimelineItem', () => {
  test('시간·장소를 sub에 "·"로 합친다(시간은 시:분까지)', () => {
    const out = toTimelineItem(ev('a', '2026-11-10', { event_time: '15:00:00', location: '르블랑 스튜디오' }));
    expect(out).toMatchObject({ id: 'a', date: '2026-11-10', sub: '15:00 · 르블랑 스튜디오', kind: 'EVENT' });
  });
  test('시간·장소 둘 다 없으면 sub는 null', () => {
    expect(toTimelineItem(ev('a', null)).sub).toBeNull();
  });
  test('시간만 있으면 시간만', () => {
    expect(toTimelineItem(ev('a', '2026-11-10', { event_time: '09:30:00' })).sub).toBe('09:30');
  });
});

describe('selectAgenda', () => {
  test('날짜별 그룹, 날짜 오름차순, 그룹 내 시간 오름차순(시간 없음은 뒤)', () => {
    const events = [
      ev('late', '2026-11-10', { event_time: '15:00:00' }),
      ev('noTime', '2026-11-10'),
      ev('early', '2026-11-10', { event_time: '09:00:00' }),
      ev('next', '2026-11-11'),
    ];
    const out = selectAgenda(events);
    expect(out.map((g) => g.date)).toEqual(['2026-11-10', '2026-11-11']);
    expect(out[0].items.map((i) => i.id)).toEqual(['early', 'late', 'noTime']);
  });
  test('날짜 미정 항목은 맨 뒤 단일 그룹', () => {
    const events = [ev('dated', '2026-11-10'), ev('undated', null)];
    const out = selectAgenda(events);
    expect(out[out.length - 1].date).toBeNull();
    expect(out[out.length - 1].items.map((i) => i.id)).toEqual(['undated']);
  });
  test('빈 목록은 빈 배열', () => {
    expect(selectAgenda([])).toEqual([]);
  });
  test('원본 배열 불변', () => {
    const events = [ev('a', '2026-11-10')];
    selectAgenda(events);
    expect(events.map((e) => e.id)).toEqual(['a']);
  });
});

describe('selectEventsOnDate', () => {
  test('해당 날짜만, 시간 오름차순(시간 없음은 뒤)', () => {
    const events = [
      ev('noTime', '2026-11-10'),
      ev('late', '2026-11-10', { event_time: '15:00:00' }),
      ev('early', '2026-11-10', { event_time: '09:00:00' }),
      ev('other', '2026-11-11'),
    ];
    expect(selectEventsOnDate(events, '2026-11-10').map((e) => e.id)).toEqual(['early', 'late', 'noTime']);
  });
  test('일치하는 항목 없으면 빈 배열', () => {
    expect(selectEventsOnDate([ev('a', '2026-11-10')], '2026-01-01')).toEqual([]);
  });
});

describe('selectMarkersByDate', () => {
  test('날짜별 category 배열로 묶는다', () => {
    const events = [
      ev('a', '2026-11-10', { category: 'EVENT' }),
      ev('b', '2026-11-10', { category: 'IMPORTANT' }),
      ev('c', null),
    ];
    expect(selectMarkersByDate(events)).toEqual({ '2026-11-10': ['EVENT', 'IMPORTANT'] });
  });
  test('일정 없으면 빈 객체', () => {
    expect(selectMarkersByDate([])).toEqual({});
  });
});

describe('selectDDay', () => {
  test('미래 날짜는 양수', () => {
    expect(selectDDay('2026-11-20', '2026-11-10')).toBe(10);
  });
  test('오늘은 0', () => {
    expect(selectDDay('2026-11-10', '2026-11-10')).toBe(0);
  });
  test('과거 날짜는 음수', () => {
    expect(selectDDay('2026-11-01', '2026-11-10')).toBe(-9);
  });
  test('날짜 미정(null)은 null', () => {
    expect(selectDDay(null, '2026-11-10')).toBeNull();
  });
});

describe('selectEventStatusChip', () => {
  const TODAY = '2026-11-10';
  test('날짜 없으면 예정(plan)', () => {
    expect(selectEventStatusChip(null, TODAY)).toEqual({ variant: 'plan', label: '예정' });
  });
  test('과거 날짜는 지남(overdue)', () => {
    expect(selectEventStatusChip('2026-11-09', TODAY)).toEqual({ variant: 'overdue', label: '지남' });
  });
  test('오늘 날짜는 오늘(today)', () => {
    expect(selectEventStatusChip('2026-11-10', TODAY)).toEqual({ variant: 'today', label: '오늘' });
  });
  test('미래 날짜는 예정(upcoming)', () => {
    expect(selectEventStatusChip('2026-11-11', TODAY)).toEqual({ variant: 'upcoming', label: '예정' });
  });
});
```

- [ ] **Step 3: 실행해 실패 확인**

```bash
npm test -- schedule/api.test.ts
```

Expected: FAIL — `selectAgenda`, `selectEventsOnDate`, `selectMarkersByDate`, `selectDDay`, `selectEventStatusChip`, `toTimelineItem`이 아직 없어 모듈 로드부터 에러.

- [ ] **Step 4: 셀렉터 구현**

`src/features/schedule/api.ts` 전체 교체(기존 `selectSchedule`은 그대로 유지, 아래는 전체 최종본):

```ts
import type { Assignee, CoupleSnapshot, EventCategory, ScheduleEvent } from '@/types/db';
import type { AgendaGroup, TimelineItem } from './types';
import * as rpc from '@/lib/rpc';

// 코어(순수) — RN/expo UI를 import하지 않는다. 셀렉터는 CoupleSnapshot이 아니라(selectSchedule 제외)
// 이미 읽어온 ScheduleEvent[]를 입력으로 받는다 — checklist의 groupByArea(items, areas)와 같은 모양.

// 읽기: 스냅샷에서 일정 슬라이스. 날짜 오름차순(미정=event_date null은 뒤로).
export function selectSchedule(snapshot: CoupleSnapshot): ScheduleEvent[] {
  return [...snapshot.schedule_events].sort((a, b) => {
    if (a.event_date === b.event_date) return 0;
    if (a.event_date === null) return 1;
    if (b.event_date === null) return -1;
    return a.event_date < b.event_date ? -1 : 1;
  });
}

function compareByTime(a: ScheduleEvent, b: ScheduleEvent): number {
  if (a.event_time === b.event_time) return 0;
  if (a.event_time === null) return 1;
  if (b.event_time === null) return -1;
  return a.event_time < b.event_time ? -1 : 1;
}

// 읽기: ScheduleEvent → TimelineItem. 지금은 schedule_event만 매핑하지만, 이후 payment/vendor도
// 같은 모양으로 합류시킬 수 있게 kind로 출처를 구분해 둔다(교차 참조는 비용 화면 완료 후, 디퍼).
export function toTimelineItem(e: ScheduleEvent): TimelineItem {
  const subParts = [e.event_time ? e.event_time.slice(0, 5) : null, e.location].filter(
    (v): v is string => !!v,
  );
  return {
    id: e.id,
    date: e.event_date,
    title: e.title,
    sub: subParts.length > 0 ? subParts.join(' · ') : null,
    kind: 'EVENT',
    category: e.category,
    areaId: e.area_id,
  };
}

// 읽기: 날짜별 그룹(아젠다 뷰). 날짜 미정 항목은 맨 뒤 단일 그룹으로 묶는다. 그룹 내부는 시간 오름차순.
export function selectAgenda(events: ScheduleEvent[]): AgendaGroup[] {
  const byDate = new Map<string, ScheduleEvent[]>();
  const undated: ScheduleEvent[] = [];
  for (const e of events) {
    if (e.event_date === null) { undated.push(e); continue; }
    const bucket = byDate.get(e.event_date) ?? [];
    bucket.push(e);
    byDate.set(e.event_date, bucket);
  }
  const groups: AgendaGroup[] = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, dayEvents]) => ({ date, items: [...dayEvents].sort(compareByTime).map(toTimelineItem) }));
  if (undated.length > 0) groups.push({ date: null, items: [...undated].sort(compareByTime).map(toTimelineItem) });
  return groups;
}

// 읽기: 특정 날짜의 일정만(캘린더 뷰 날짜 탭 상세용). 시간 오름차순.
export function selectEventsOnDate(events: ScheduleEvent[], date: string): ScheduleEvent[] {
  return events.filter((e) => e.event_date === date).sort(compareByTime);
}

// 읽기: 날짜별 등록된 카테고리 목록(캘린더 날짜 칸 마커용).
export function selectMarkersByDate(events: ScheduleEvent[]): Record<string, EventCategory[]> {
  const map: Record<string, EventCategory[]> = {};
  for (const e of events) {
    if (!e.event_date) continue;
    (map[e.event_date] ??= []).push(e.category);
  }
  return map;
}

// 읽기: D-day(순수, today 주입). 예식일 미정(null)이면 null. KST 기준 date-only 문자열 간 차이.
export function selectDDay(weddingDate: string | null, today: string): number | null {
  if (!weddingDate) return null;
  const diffMs = new Date(`${weddingDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime();
  return Math.round(diffMs / 86400000);
}

// 읽기: 일정 상태 칩(체크리스트 selectStatusChip과 동일 모양, today 주입). 일정엔 완료 개념이
// 없어 날짜만으로 판정한다.
export type ScheduleStatusChip = { variant: 'overdue' | 'today' | 'upcoming' | 'plan'; label: string };
export function selectEventStatusChip(date: string | null, today: string): ScheduleStatusChip {
  if (!date) return { variant: 'plan', label: '예정' };
  if (date < today) return { variant: 'overdue', label: '지남' };
  if (date === today) return { variant: 'today', label: '오늘' };
  return { variant: 'upcoming', label: '예정' };
}

// 로컬 타임존 기준 오늘 날짜(YYYY-MM-DD). 체크리스트의 todayDateString과 동일 모양이지만, 도메인
// 독립(단방향 계층) 원칙상 features 간 교차 import를 피해 이 파일에 동일 순수 함수를 둔다.
export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 쓰기: lib/rpc 위임(ADR-0003 — supabase.rpc는 lib/rpc에만). shareCode는 호출 훅이 주입.
// area_id는 생성 시에만 지정(체크리스트와 동일 관례 — 수정은 영역을 바꾸지 않는다).
export type CreateScheduleEventInput = {
  areaId?: string | null;
  title: string;
  eventDate?: string | null;
  eventTime?: string | null;
  location?: string | null;
  assignee?: Assignee | null;
  category: EventCategory;
};
export type UpdateScheduleEventInput = {
  id: string;
  title: string;
  eventDate?: string | null;
  eventTime?: string | null;
  location?: string | null;
  assignee?: Assignee | null;
  category: EventCategory;
};

export function createScheduleEvent(shareCode: string, input: CreateScheduleEventInput) {
  return rpc.createScheduleEvent(shareCode, input);
}
export function updateScheduleEvent(shareCode: string, input: UpdateScheduleEventInput) {
  return rpc.updateScheduleEvent(shareCode, input);
}
export function deleteScheduleEvent(shareCode: string, id: string) {
  return rpc.deleteScheduleEvent(shareCode, id);
}
```

주의: 이 단계에서 `rpc.createScheduleEvent` 등은 아직 `lib/rpc.ts`에 없다(Task 3에서 추가). 이 Step만 실행하면 `npx tsc --noEmit`이 해당 3개 심볼에서 에러를 낸다 — **정상**이다. Step 5에서 테스트만 돌리고(타입체크는 Task 3 끝에서), 셀렉터 테스트는 이 심볼들과 무관하게 통과해야 한다.

- [ ] **Step 5: 셀렉터 테스트 통과 확인**

```bash
npm test -- schedule/api.test.ts
```

Expected: PASS(전부). `rpc.ts` 쪽 타입 에러는 `tsc`에서만 나타나고 jest(런타임)는 영향받지 않는다 — jest-expo는 타입을 검사하지 않는다.

- [ ] **Step 6: 캐시 리듀서 테스트 작성(실패 유도)**

`src/features/schedule/cache.test.ts` 신규 생성:

```ts
import type { CoupleSnapshot, ScheduleEvent } from '@/types/db';
import { applyCreate, applyDelete, applyUpdate } from './cache';

const ev = (id: string, date: string | null = null): ScheduleEvent => ({
  id, created_at: '', couple_id: 'c1', area_id: null, title: id, event_date: date,
  event_time: null, location: null, assignee: null, category: 'EVENT', reminder_at: null, origin: 'USER',
});
const snap = (events: ScheduleEvent[]): CoupleSnapshot => ({ schedule_events: events } as CoupleSnapshot);

describe('applyCreate', () => {
  test('추가 후 개수 증가, 기존 항목 보존, 원본 불변', () => {
    const s0 = snap([ev('a')]);
    const out = applyCreate(s0, ev('b'));
    expect(out.schedule_events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(s0.schedule_events).toHaveLength(1); // 원본 보존
  });
});

describe('applyUpdate', () => {
  test('지정 필드만 변경, 나머지(area_id 등) 보존', () => {
    const out = applyUpdate(snap([ev('a', '2026-11-10')]), {
      id: 'a', title: '새 제목', eventDate: '2026-12-01', eventTime: '10:00',
      location: '새 장소', assignee: 'ME', category: 'IMPORTANT',
    });
    expect(out.schedule_events[0]).toMatchObject({
      title: '새 제목', event_date: '2026-12-01', event_time: '10:00',
      location: '새 장소', assignee: 'ME', category: 'IMPORTANT', area_id: null, id: 'a',
    });
  });
  test('보존성: 대상 외 항목 불변', () => {
    const out = applyUpdate(snap([ev('a'), ev('b')]), {
      id: 'a', title: 'x', eventDate: null, eventTime: null, location: null, assignee: null, category: 'EVENT',
    });
    expect(out.schedule_events[1]).toEqual(ev('b'));
  });
  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([ev('a')]);
    const out = applyUpdate(s0, {
      id: 'zzz', title: 'x', eventDate: null, eventTime: null, location: null, assignee: null, category: 'EVENT',
    });
    expect(out.schedule_events).toEqual(s0.schedule_events);
  });
});

describe('applyDelete', () => {
  test('해당 id 제거, 나머지 보존', () => {
    const out = applyDelete(snap([ev('a'), ev('b')]), 'a');
    expect(out.schedule_events.map((e) => e.id)).toEqual(['b']);
  });
  test('병리: 없는 id는 개수 불변', () => {
    expect(applyDelete(snap([ev('a')]), 'zzz').schedule_events).toHaveLength(1);
  });
});
```

- [ ] **Step 7: 실행해 실패 확인**

```bash
npm test -- schedule/cache.test.ts
```

Expected: FAIL — `./cache` 모듈이 아직 없음.

- [ ] **Step 8: 캐시 리듀서 구현**

`src/features/schedule/cache.ts` 신규 생성:

```ts
import type { CoupleSnapshot, ScheduleEvent } from '@/types/db';
import type { UpdateScheduleEventInput } from './api';

// 스냅샷 캐시 낙관적 패치(순수·불변). CoupleSnapshot을 받아 새 스냅샷을 반환한다.
// checklist/cache.ts와 동일 모양 — 일정엔 완료 개념이 없어 toggle류는 없다.

function withEvents(s: CoupleSnapshot, events: ScheduleEvent[]): CoupleSnapshot {
  return { ...s, schedule_events: events };
}

export function applyCreate(s: CoupleSnapshot, event: ScheduleEvent): CoupleSnapshot {
  return withEvents(s, [...s.schedule_events, event]);
}

export function applyUpdate(s: CoupleSnapshot, patch: UpdateScheduleEventInput): CoupleSnapshot {
  return withEvents(
    s,
    s.schedule_events.map((e) =>
      e.id === patch.id
        ? {
            ...e,
            title: patch.title,
            event_date: patch.eventDate ?? null,
            event_time: patch.eventTime ?? null,
            location: patch.location ?? null,
            assignee: patch.assignee ?? null,
            category: patch.category,
          }
        : e,
    ),
  );
}

export function applyDelete(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return withEvents(s, s.schedule_events.filter((e) => e.id !== id));
}
```

- [ ] **Step 9: 캐시 테스트 통과 확인**

```bash
npm test -- schedule
```

Expected: `schedule/api.test.ts`·`schedule/cache.test.ts` 전부 PASS.

- [ ] **Step 10: 커밋**

```bash
git add src/features/schedule/types.ts src/features/schedule/api.ts src/features/schedule/api.test.ts src/features/schedule/cache.ts src/features/schedule/cache.test.ts
git commit -m "$(cat <<'EOF'
feat(schedule): 일정 셀렉터·캐시 리듀서 — 아젠다 그룹핑·D-day·상태 칩

캘린더/리스트 뷰·날짜 탭 상세가 쓸 순수 셀렉터(selectAgenda·selectEventsOnDate·
selectMarkersByDate·selectDDay·selectEventStatusChip)와 낙관적 캐시 리듀서를
체크리스트 슬라이스와 동일 패턴으로 추가. 비용/업체 교차 참조는 TimelineItem의
kind 필드로 추후 합류 가능하게만 설계하고 이번 범위에서는 제외.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 쓰기 RPC — 마이그레이션 + 적용 + lib/rpc 래퍼

**Files:**
- Create: `supabase/migrations/0003_schedule_writes.sql`
- Modify: `src/lib/rpc.ts`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/0003_schedule_writes.sql` 신규 생성:

```sql
-- Phase 1 일정 쓰기 RPC (ADR-0003). 체크리스트 쓰기 RPC(0002)와 동일 패턴 — couple 테이블은
-- security-definer로만 접근, p_share_code로 couple_id를 서버에서 해소한다.
-- Broadcast 트리거(trg_bc_schedule)·get_couple_snapshot은 이미 schedule_event를 포함(0001)
-- → 여기선 쓰기 RPC만 추가한다. 일정엔 완료 개념이 없어 체크리스트의 toggle류는 없다.
-- area_id는 생성 시에만 지정(체크리스트와 동일 관례 — 수정 RPC는 영역을 바꾸지 않는다).

create or replace function public.create_schedule_event(
  p_share_code text, p_area_id uuid, p_title text, p_event_date date,
  p_event_time time, p_location text, p_assignee assignee, p_category event_category
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row schedule_event%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into schedule_event (couple_id, area_id, title, event_date, event_time, location, assignee, category)
    values (v_couple, p_area_id, p_title, p_event_date, p_event_time, p_location, p_assignee, p_category)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.update_schedule_event(
  p_share_code text, p_id uuid, p_title text, p_event_date date,
  p_event_time time, p_location text, p_assignee assignee, p_category event_category
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row schedule_event%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update schedule_event set
    title = p_title, event_date = p_event_date, event_time = p_event_time,
    location = p_location, assignee = p_assignee, category = p_category
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'event not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_schedule_event(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from schedule_event where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'event not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

grant execute on function public.create_schedule_event(text,uuid,text,date,time,text,assignee,event_category) to anon;
grant execute on function public.update_schedule_event(text,uuid,text,date,time,text,assignee,event_category) to anon;
grant execute on function public.delete_schedule_event(text,uuid) to anon;
```

- [ ] **Step 2: Supabase에 적용 — ⚠️ 사용자 액션 필요**

이 저장소에는 Supabase CLI 링크(`supabase link`)도 MCP Supabase 도구도 없어서(이번 세션에서 직접
확인 — `supabase projects list`가 `AccessTokenRequiredError`를 냄), **Claude가 직접 원격 DB에 DDL을
실행할 수 없다.** 0002 체크리스트 마이그레이션도 같은 이유로 수동 적용됐을 가능성이 높다.

사용자에게 요청: Supabase 대시보드 → 해당 프로젝트(`kozaxtwyfphslkyxpxhu`) → SQL Editor에서 위
`0003_schedule_writes.sql` 전체 내용을 붙여넣고 실행. 완료되면 다음 Step으로 진행.

(만약 사용자가 `supabase login`으로 CLI를 연결해 두고 싶다면 `npx supabase login` 후
`npx supabase link --project-ref kozaxtwyfphslkyxpxhu`로 연결하고 `npx supabase db push`로 적용하는
경로도 가능하지만, 로그인은 브라우저 인증이 필요해 Claude가 대신할 수 없다 — 둘 중 사용자가 편한
방법을 선택.)

- [ ] **Step 3: lib/rpc 래퍼 추가**

`src/lib/rpc.ts`에서 import 블록과 파일 끝에 추가. 상단 import를 교체:

```ts
import { supabase } from './supabase';
import type { ChecklistItem, CoupleSnapshot, ScheduleEvent, WeddingDateStatus } from '@/types/db';
import type { CreateChecklistItemInput, UpdateChecklistItemInput } from '@/features/checklist/api';
import type { CreateScheduleEventInput, UpdateScheduleEventInput } from '@/features/schedule/api';
```

파일 끝(`deleteChecklistItem` 함수 다음)에 추가:

```ts
// ── 일정 쓰기 RPC (ADR-0003: supabase.rpc는 이 파일에만) ──
export async function createScheduleEvent(
  shareCode: string, input: CreateScheduleEventInput,
): Promise<ScheduleEvent> {
  const { data, error } = await supabase.rpc('create_schedule_event', {
    p_share_code: shareCode, p_area_id: input.areaId ?? null, p_title: input.title,
    p_event_date: input.eventDate ?? null, p_event_time: input.eventTime ?? null,
    p_location: input.location ?? null, p_assignee: input.assignee ?? null, p_category: input.category,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ScheduleEvent;
}

export async function updateScheduleEvent(
  shareCode: string, input: UpdateScheduleEventInput,
): Promise<ScheduleEvent> {
  const { data, error } = await supabase.rpc('update_schedule_event', {
    p_share_code: shareCode, p_id: input.id, p_title: input.title,
    p_event_date: input.eventDate ?? null, p_event_time: input.eventTime ?? null,
    p_location: input.location ?? null, p_assignee: input.assignee ?? null, p_category: input.category,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ScheduleEvent;
}

export async function deleteScheduleEvent(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_schedule_event', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}
```

- [ ] **Step 4: 타입체크 + RPC 격리 실측**

```bash
npx tsc --noEmit
```

Expected: 0에러(Task 2에서 남겨뒀던 `rpc.createScheduleEvent` 등 미해결 참조가 이제 해소됨).

Supabase에 0003을 적용한 뒤, 프로젝트 루트에 1회용 Node 스크립트(ESM)로 RPC 왕복을 실측한다.
`scratchpad` 디렉토리가 아니라 **루트에 둬야 node_modules가 해소된다**(HANDOFF.md 패턴).

`verify-schedule-rpc.mjs`(루트, 임시):

```js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_KEY);

// 실제 테스트용 공유 코드로 교체(온보딩으로 발급받은 코드).
const SHARE_CODE = process.argv[2];
if (!SHARE_CODE) { console.error('사용법: node verify-schedule-rpc.mjs <share_code>'); process.exit(1); }

const { data: created, error: createErr } = await supabase.rpc('create_schedule_event', {
  p_share_code: SHARE_CODE, p_area_id: null, p_title: '스모크 테스트 일정',
  p_event_date: '2026-12-25', p_event_time: '15:00', p_location: '테스트 장소',
  p_assignee: 'BOTH', p_category: 'EVENT',
});
console.log('create:', createErr ?? created);

const { data: updated, error: updateErr } = await supabase.rpc('update_schedule_event', {
  p_share_code: SHARE_CODE, p_id: created.id, p_title: '수정됨',
  p_event_date: '2026-12-26', p_event_time: null, p_location: null,
  p_assignee: 'ME', p_category: 'IMPORTANT',
});
console.log('update:', updateErr ?? updated);

const { data: deleted, error: deleteErr } = await supabase.rpc('delete_schedule_event', {
  p_share_code: SHARE_CODE, p_id: created.id,
});
console.log('delete:', deleteErr ?? deleted);

const { data: wrongCode, error: isolationErr } = await supabase.rpc('create_schedule_event', {
  p_share_code: 'invalid-code-xyz', p_area_id: null, p_title: 'x',
  p_event_date: null, p_event_time: null, p_location: null, p_assignee: null, p_category: 'EVENT',
});
console.log('격리(무효 코드는 PT401 기대):', isolationErr?.code, wrongCode);
```

```bash
node verify-schedule-rpc.mjs <실제 공유 코드>
```

Expected: create/update/delete 전부 데이터 반환(에러 없음), 마지막 격리 체크는 `code: 'PT401'` 에러.

**검증 끝나면 즉시 삭제**(임시 계측 제거 원칙):

```bash
rm verify-schedule-rpc.mjs
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0003_schedule_writes.sql src/lib/rpc.ts
git commit -m "$(cat <<'EOF'
feat(schedule): 일정 쓰기 RPC 3종 + lib/rpc 래퍼

create_schedule_event/update_schedule_event/delete_schedule_event를 체크리스트
쓰기 RPC(0002)와 동일 패턴(p_share_code로 couple_id 해소, PT401/PT404)으로 추가.
스냅샷 함수·Broadcast 트리거는 이미 schedule_event를 포함해 변경 없음.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 전역 참조 — 길일(auspicious_day)

**Files:**
- Modify: `src/types/db.ts`
- Modify: `src/lib/reference.ts`
- Create: `src/hooks/use-auspicious-days.ts`

- [ ] **Step 1: 타입 추가**

`src/types/db.ts`에서 `Area` 타입 바로 아래에 추가:

```ts
export type AuspiciousDay = {
  id: string;
  created_at: string;
  day: string; // YYYY-MM-DD
  note: string | null;
};
```

- [ ] **Step 2: 직접 조회 함수**

`src/lib/reference.ts` 전체 교체:

```ts
import { supabase } from './supabase';
import type { Area, AuspiciousDay } from '@/types/db';

// 전역 참조(ADR-0003: area·seed_*·auspicious_day만 직접 select 허용 — 공개 읽기 정책).
// 커플 데이터가 아니므로 RPC 게이트웨이를 거치지 않는다.
export async function getAreas(): Promise<Area[]> {
  const { data, error } = await supabase.from('area').select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []) as Area[];
}

export async function getAuspiciousDays(): Promise<AuspiciousDay[]> {
  const { data, error } = await supabase.from('auspicious_day').select('*').order('day');
  if (error) throw error;
  return (data ?? []) as AuspiciousDay[];
}
```

- [ ] **Step 3: 참조 쿼리 훅**

`src/hooks/use-auspicious-days.ts` 신규 생성:

```ts
import { useQuery } from '@tanstack/react-query';
import { getAuspiciousDays } from '@/lib/reference';

// 전역 참조라 거의 안 바뀌므로 길게 캐시한다(use-areas.ts와 동일 모양). 공유 코드와 무관.
export function useAuspiciousDays() {
  return useQuery({
    queryKey: ['auspiciousDays'],
    queryFn: getAuspiciousDays,
    staleTime: 1000 * 60 * 60, // 1h
  });
}
```

- [ ] **Step 4: 타입체크 + 커밋**

```bash
npx tsc --noEmit
```

Expected: 0에러.

```bash
git add src/types/db.ts src/lib/reference.ts src/hooks/use-auspicious-days.ts
git commit -m "$(cat <<'EOF'
feat(schedule): 길일(auspicious_day) 전역 참조 훅

캘린더 뷰의 길일 표시용. area 전역 참조(lib/reference.ts getAreas)와 동일한
직접 조회 패턴 — RPC 게이트웨이를 거치지 않는 공개 읽기 정책(ADR-0003).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: mutation 훅 + 배럴

**Files:**
- Modify: `src/features/schedule/hooks.ts`
- Modify: `src/features/schedule/index.ts`

- [ ] **Step 1: mutation 훅 구현**

`src/features/schedule/hooks.ts` 전체 교체:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { CoupleSnapshot, ScheduleEvent } from '@/types/db';
import * as api from './api';
import * as cache from './cache';

// 일정 읽기. 공유 스냅샷 캐시 위에 select로 슬라이스를 얹는다.
export function useSchedule() {
  return useCoupleSnapshot(api.selectSchedule);
}

// 낙관적 뮤테이션 공통 배선: onMutate에서 스냅샷 캐시를 순수 리듀서로 즉시 패치,
// onError 롤백(이전 스냅샷 복원), onSettled invalidate. checklist/hooks.ts와 동일 구조이지만
// 도메인 독립(단방향 계층) 원칙상 공유 추상화로 뽑지 않는다(두 군데뿐이라 YAGNI).
function useScheduleMutation<TArgs>(
  mutationFn: (code: string, args: TArgs) => Promise<unknown>,
  optimistic: (s: CoupleSnapshot, args: TArgs) => CoupleSnapshot,
) {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: (args: TArgs) => mutationFn(shareCode as string, args),
    onMutate: async (args: TArgs) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CoupleSnapshot>(key);
      if (prev) qc.setQueryData(key, optimistic(prev, args));
      return { prev };
    },
    onError: (_e, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCreateScheduleEvent() {
  return useScheduleMutation<api.CreateScheduleEventInput>(
    (code, input) => api.createScheduleEvent(code, input),
    (s, input) => {
      // 낙관적 임시 행(서버 응답 전).
      const temp: ScheduleEvent = {
        id: `optimistic-${Date.now()}`, created_at: new Date().toISOString(),
        couple_id: s.couple.id, area_id: input.areaId ?? null, title: input.title,
        event_date: input.eventDate ?? null, event_time: input.eventTime ?? null,
        location: input.location ?? null, assignee: input.assignee ?? null,
        category: input.category, reminder_at: null, origin: 'USER',
      };
      return cache.applyCreate(s, temp);
    },
  );
}

export function useUpdateScheduleEvent() {
  return useScheduleMutation<api.UpdateScheduleEventInput>(
    (code, input) => api.updateScheduleEvent(code, input),
    (s, input) => cache.applyUpdate(s, input),
  );
}

export function useDeleteScheduleEvent() {
  return useScheduleMutation<{ id: string }>(
    (code, { id }) => api.deleteScheduleEvent(code, id),
    (s, { id }) => cache.applyDelete(s, id),
  );
}
```

- [ ] **Step 2: 배럴 갱신**

`src/features/schedule/index.ts` 전체 교체:

```ts
// schedule 도메인 공개 API(배럴).
export {
  useSchedule, useCreateScheduleEvent, useUpdateScheduleEvent, useDeleteScheduleEvent,
} from './hooks';
export {
  selectSchedule, selectAgenda, selectEventsOnDate, selectMarkersByDate,
  selectDDay, selectEventStatusChip, todayDateString, toTimelineItem,
} from './api';
export type { CreateScheduleEventInput, UpdateScheduleEventInput, ScheduleStatusChip } from './api';
export type { TimelineItem, AgendaGroup } from './types';
```

- [ ] **Step 3: 타입체크 + 커밋**

```bash
npx tsc --noEmit
npm test
```

Expected: 둘 다 0에러/통과.

```bash
git add src/features/schedule/hooks.ts src/features/schedule/index.ts
git commit -m "$(cat <<'EOF'
feat(schedule): mutation 훅 3종 — 생성·수정·삭제 낙관적 캐시 배선

checklist/hooks.ts의 useChecklistMutation과 동일 구조(onMutate 패치·onError
롤백·onSettled invalidate). 일정엔 완료 개념이 없어 toggle 훅은 없음.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 도메인 전용 컴포넌트

**Files:**
- Create: `src/features/schedule/components/event-row.tsx`
- Create: `src/features/schedule/components/agenda-view.tsx`
- Create: `src/features/schedule/components/calendar-view.tsx`
- Create: `src/features/schedule/components/schedule-form.tsx`

- [ ] **Step 1: 일정 행(EventRow)**

`src/features/schedule/components/event-row.tsx` 신규 생성:

```tsx
import { Pressable, View } from 'react-native';
import { Chip, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { Area, EventCategory } from '@/types/db';
import type { TimelineItem } from '../types';
import { selectEventStatusChip, todayDateString } from '../api';

// 카테고리별 리드 점 색(design/schedule.html 범례 — 일정=세이지, 중요=테라코타).
// MILESTONE은 시드 전용(폼 비노출)이라 중립 블러시로 예비 매핑만 둔다.
const CATEGORY_DOT: Record<EventCategory, 'sage' | 'terracotta' | 'blush'> = {
  EVENT: 'sage', IMPORTANT: 'terracotta', MILESTONE: 'blush',
};

// 일정 한 줄: 카테고리 점 + 제목 + sub(시간·장소) + 영역 이름 + 우측 상태 칩.
// 체크리스트 CheckRow와 같은 모양이지만 체크박스가 없다(일정엔 완료 개념 없음).
export function EventRow({
  item, first, areas, onPress,
}: { item: TimelineItem; first: boolean; areas: Area[]; onPress: () => void }) {
  const area = areas.find((a) => a.id === item.areaId);
  const statusChip = selectEventStatusChip(item.date, todayDateString());
  const subLine = [item.sub, area?.name_ko].filter(Boolean).join('  ·  ');

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingVertical: spacing.lg, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line,
      }}
    >
      <View style={{ paddingTop: 7 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors[CATEGORY_DOT[item.category]] }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" color="ink">{item.title}</Text>
        {subLine ? (
          <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>{subLine}</Text>
        ) : null}
      </View>
      <Chip variant={statusChip.variant} label={statusChip.label} />
    </Pressable>
  );
}
```

- [ ] **Step 2: 아젠다(리스트) 뷰**

`src/features/schedule/components/agenda-view.tsx` 신규 생성:

```tsx
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import type { Area } from '@/types/db';
import type { AgendaGroup } from '../types';
import { EventRow } from './event-row';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

function formatGroupDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const w = WEEKDAY[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 · ${w}요일`;
}

// 날짜 그룹별 일정 리스트(아젠다 뷰). 빈 상태 포함.
export function AgendaView({
  groups, areas, onEdit,
}: { groups: AgendaGroup[]; areas: Area[]; onEdit: (id: string) => void }) {
  if (groups.length === 0) {
    return (
      <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
        <Text variant="body" color="inkMuted">아직 등록된 일정이 없습니다.</Text>
      </View>
    );
  }
  return (
    <View>
      {groups.map((g) => (
        <View key={g.date ?? 'undated'} style={{ marginTop: spacing.xl }}>
          <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>
            {g.date ? formatGroupDate(g.date) : '날짜 미정'}
          </Text>
          {g.items.map((item, idx) => (
            <EventRow key={item.id} item={item} first={idx === 0} areas={areas} onPress={() => onEdit(item.id)} />
          ))}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 3: 캘린더 뷰**

`src/features/schedule/components/calendar-view.tsx` 신규 생성:

```tsx
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import {
  buildMonthGrid, monthLabel, shiftMonth, WEEKDAY_LABELS, type CalendarCell,
} from '@/components/ui/calendar-grid';
import { colors, radius, spacing } from '@/constants/theme';
import type { EventCategory } from '@/types/db';

const CATEGORY_DOT: Record<EventCategory, 'sage' | 'terracotta' | 'blush'> = {
  EVENT: 'sage', IMPORTANT: 'terracotta', MILESTONE: 'blush',
};
const CELL_PCT = `${100 / 7}%`;

export type CalendarViewProps = {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  markersByDate: Record<string, EventCategory[]>;
  auspiciousDates: Set<string>;
  todayStr: string;
};

// 월 그리드(읽기 전용 + 날짜 탭). CalendarPicker와 달리 모달이 아니라 화면에 상시 노출되고,
// 선택 상태는 부모(schedule.tsx)가 들고 있다(날짜 탭 → 하단 상세 리스트 전환, 사용자 결정 2026-11-08).
// 월 그리드 계산은 CalendarPicker와 같은 순수 로직(calendar-grid.ts)을 재사용한다.
export function CalendarView({
  selectedDate, onSelectDate, markersByDate, auspiciousDates, todayStr,
}: CalendarViewProps) {
  const [view, setView] = useState({
    year: Number(selectedDate.slice(0, 4)),
    month: Number(selectedDate.slice(5, 7)) - 1,
  });
  const cells = buildMonthGrid(view.year, view.month);

  return (
    <View style={{
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong,
      borderRadius: radius.md, padding: spacing.lg,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Pressable onPress={() => setView((v) => shiftMonth(v.year, v.month, -1))} hitSlop={8}>
          <Text variant="title">‹</Text>
        </Pressable>
        <Text variant="titleSm">{monthLabel(view.year, view.month)}</Text>
        <Pressable onPress={() => setView((v) => shiftMonth(v.year, v.month, 1))} hitSlop={8}>
          <Text variant="title">›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <View key={w} style={{ width: CELL_PCT, alignItems: 'center', paddingBottom: spacing.xs }}>
            <Text variant="caption" color={i === 0 || i === 6 ? 'blushInk' : 'inkMuted'}>{w}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((cell, idx) => (
          <DayCell
            key={idx}
            cell={cell}
            todayStr={todayStr}
            selectedDate={selectedDate}
            categories={cell ? markersByDate[cell.dateStr] ?? [] : []}
            isAuspicious={!!cell && auspiciousDates.has(cell.dateStr)}
            onPress={() => cell && onSelectDate(cell.dateStr)}
          />
        ))}
      </View>
    </View>
  );
}

function DayCell({
  cell, todayStr, selectedDate, categories, isAuspicious, onPress,
}: {
  cell: CalendarCell; todayStr: string; selectedDate: string; categories: EventCategory[];
  isAuspicious: boolean; onPress: () => void;
}) {
  if (!cell) return <View style={{ width: CELL_PCT, aspectRatio: 1 }} />;

  const isToday = cell.dateStr === todayStr;
  const isSelected = cell.dateStr === selectedDate;
  const isWeekend = cell.weekday === 0 || cell.weekday === 6;
  const textColor = isToday ? 'surface' : isAuspicious ? 'terracottaInk' : isWeekend ? 'blushInk' : 'ink';

  return (
    <Pressable
      onPress={onPress}
      style={{ width: CELL_PCT, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel={cell.dateStr}
    >
      <View
        style={{
          width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isToday ? colors.blushInk : 'transparent',
          borderWidth: isSelected && !isToday ? 2 : 0,
          borderColor: colors.blushInk,
        }}
      >
        <Text
          variant="bodySm"
          color={isSelected && !isToday ? 'blushInk' : textColor}
          style={isToday || isAuspicious ? { fontWeight: '700' } : undefined}
        >
          {cell.day}
        </Text>
      </View>
      {categories.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2, height: 4 }}>
          {categories.slice(0, 3).map((c, i) => (
            <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors[CATEGORY_DOT[c]] }} />
          ))}
        </View>
      ) : (
        <View style={{ height: 4, marginTop: 2 }} />
      )}
    </Pressable>
  );
}
```

- [ ] **Step 4: 추가/수정 폼**

`src/features/schedule/components/schedule-form.tsx` 신규 생성:

```tsx
import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Button, Chip, DateField, Segmented, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area, Assignee, EventCategory, ScheduleEvent } from '@/types/db';

export type ScheduleFormValue = {
  areaId: string | null;
  title: string;
  eventDate: string | null;
  eventTime: string | null;
  location: string | null;
  assignee: Assignee | null;
  category: EventCategory;
};

const ASSIGNEE_OPTS = [
  { key: 'ME', label: '나' }, { key: 'PARTNER', label: '애인' },
  { key: 'BOTH', label: '공동' }, { key: 'NONE', label: '미정' },
];
const CATEGORY_OPTS: { key: EventCategory; label: string }[] = [
  { key: 'EVENT', label: '일정' }, { key: 'IMPORTANT', label: '중요' },
];

// 추가/수정 공용 모달. editing이 있으면 수정 모드(영역 고정 — area_id는 생성 시에만 지정하는
// 체크리스트와 동일 관례). 날짜는 DateField(달력 선택), 시간은 자유 텍스트("HH:MM" 권장 — 전용
// 시간 피커는 이번 슬라이스 범위 밖, 세부 기능은 실테스트 후 개선하는 프로젝트 방침).
export function ScheduleForm({
  visible, areas, editing, defaultAreaId, onSubmit, onDelete, onClose,
}: {
  visible: boolean;
  areas: Area[];
  editing: ScheduleEvent | null;
  defaultAreaId: string | null;
  onSubmit: (v: ScheduleFormValue) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [areaId, setAreaId] = useState<string | null>(editing?.area_id ?? defaultAreaId ?? null);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [eventDate, setEventDate] = useState<string | null>(editing?.event_date ?? null);
  const [eventTime, setEventTime] = useState(editing?.event_time ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [assignee, setAssignee] = useState<string>(editing?.assignee ?? 'NONE');
  const [category, setCategory] = useState<EventCategory>(editing?.category ?? 'EVENT');

  const canSave = title.trim().length > 0;

  const submit = () => {
    onSubmit({
      areaId,
      title: title.trim(),
      eventDate,
      eventTime: eventTime.trim() ? eventTime.trim() : null,
      location: location.trim() ? location.trim() : null,
      assignee: assignee === 'NONE' ? null : (assignee as Assignee),
      category,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ backgroundColor: colors.ground, padding: layout.screenPadding, gap: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <Text variant="title">{editing ? '일정 수정' : '일정 추가'}</Text>

        {!editing ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Pressable onPress={() => setAreaId(null)}>
              <Chip variant={areaId === null ? 'area' : 'ghost'} label="없음" />
            </Pressable>
            {areas.map((a) => (
              <Pressable key={a.id} onPress={() => setAreaId(a.id)}>
                <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextInput
          value={title} onChangeText={setTitle} placeholder="일정 제목" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <DateField value={eventDate} onChange={setEventDate} placeholder="날짜 선택 (선택)" />
        <TextInput
          value={eventTime} onChangeText={setEventTime} placeholder="시간 (예: 15:00, 선택)" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <TextInput
          value={location} onChangeText={setLocation} placeholder="장소 (선택)" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <Segmented options={CATEGORY_OPTS} value={category} onChange={(k) => setCategory(k as EventCategory)} />
        <Segmented options={ASSIGNEE_OPTS} value={assignee} onChange={setAssignee} />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {editing && onDelete ? <Button variant="ghost" label="삭제" onPress={onDelete} /> : null}
          <View style={{ flex: 1 }} />
          <Button variant="ghost" label="취소" onPress={onClose} />
          <Button label="저장" onPress={submit} disabled={!canSave} />
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;
```

- [ ] **Step 5: 타입체크 + 커밋**

```bash
npx tsc --noEmit
```

Expected: 0에러(아직 화면에서 쓰지 않아 미사용 export 경고는 없음 — 전부 named export).

```bash
git add src/features/schedule/components/
git commit -m "$(cat <<'EOF'
feat(schedule): 일정 화면 전용 컴포넌트 — EventRow·AgendaView·CalendarView·ScheduleForm

체크리스트의 CheckRow/AreaSection/ChecklistForm과 같은 모양. CalendarView는
calendar-grid.ts의 순수 월 그리드 계산을 재사용(CalendarPicker와 공유)하되 모달이
아니라 화면에 상시 노출되는 날짜 탭 상호작용으로 구현(사용자 결정 2026-11-08).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 화면 조립

**Files:**
- Modify: `src/app/(tabs)/schedule.tsx`

- [ ] **Step 1: 화면 구현**

`src/app/(tabs)/schedule.tsx` 전체 교체:

```tsx
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fab, PageHead, Segmented, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useCouple } from '@/features/couple';
import {
  selectAgenda, selectDDay, selectEventsOnDate, selectMarkersByDate, todayDateString, toTimelineItem,
  useCreateScheduleEvent, useDeleteScheduleEvent, useSchedule, useUpdateScheduleEvent,
} from '@/features/schedule';
import { AgendaView } from '@/features/schedule/components/agenda-view';
import { CalendarView } from '@/features/schedule/components/calendar-view';
import { EventRow } from '@/features/schedule/components/event-row';
import { ScheduleForm, type ScheduleFormValue } from '@/features/schedule/components/schedule-form';
import { useAreas } from '@/hooks/use-areas';
import { useAuspiciousDays } from '@/hooks/use-auspicious-days';
import type { ScheduleEvent } from '@/types/db';

export default function ScheduleScreen() {
  const { data: events = [] } = useSchedule();
  const { data: areas = [] } = useAreas();
  const { data: auspiciousDays = [] } = useAuspiciousDays();
  const { data: couple } = useCouple();
  const create = useCreateScheduleEvent();
  const update = useUpdateScheduleEvent();
  const remove = useDeleteScheduleEvent();

  const today = todayDateString();
  const [view, setView] = useState<'cal' | 'list'>('cal');
  const [selectedDate, setSelectedDate] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  // 열 때마다 증가시켜 ScheduleForm을 리마운트(ChecklistForm과 동일한 이유 — visible만 토글하면
  // 내부 state에 이전 입력이 남는다).
  const [formKey, setFormKey] = useState(0);

  const agenda = useMemo(() => selectAgenda(events), [events]);
  const markersByDate = useMemo(() => selectMarkersByDate(events), [events]);
  const dayItems = useMemo(
    () => selectEventsOnDate(events, selectedDate).map(toTimelineItem),
    [events, selectedDate],
  );
  const auspiciousDates = useMemo(() => new Set(auspiciousDays.map((d) => d.day)), [auspiciousDays]);
  const dday = couple ? selectDDay(couple.wedding_date, today) : null;

  const openAdd = () => { setEditing(null); setFormKey((k) => k + 1); setFormOpen(true); };
  const openEdit = (id: string) => {
    const found = events.find((e) => e.id === id) ?? null;
    setEditing(found);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);

  const submitForm = (v: ScheduleFormValue) => {
    if (editing) {
      update.mutate({
        id: editing.id, title: v.title, eventDate: v.eventDate, eventTime: v.eventTime,
        location: v.location, assignee: v.assignee, category: v.category,
      });
    } else {
      create.mutate(v);
    }
    closeForm();
  };
  const deleteCurrent = () => {
    if (editing) remove.mutate({ id: editing.id });
    closeForm();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: layout.tabBarHeight + 80 }}>
        <PageHead
          title="일정"
          sub={couple ? `${couple.groom_name} & ${couple.bride_name}` : undefined}
          dday={dday !== null ? `D-${dday}` : undefined}
        />

        <View style={{ marginTop: spacing.lg }}>
          <Segmented
            options={[{ key: 'cal', label: '캘린더' }, { key: 'list', label: '리스트' }]}
            value={view}
            onChange={(k) => setView(k as 'cal' | 'list')}
          />
        </View>

        {view === 'cal' ? (
          <View style={{ marginTop: spacing.xl }}>
            <CalendarView
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              markersByDate={markersByDate}
              auspiciousDates={couple?.show_auspicious_days ? auspiciousDates : new Set()}
              todayStr={today}
            />
            <View style={{ marginTop: spacing.xl }}>
              <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>
                {selectedDate === today ? '오늘 일정' : `${selectedDate} 일정`}
              </Text>
              {dayItems.length === 0 ? (
                <Text variant="body" color="inkMuted">등록된 일정이 없습니다.</Text>
              ) : (
                dayItems.map((item, idx) => (
                  <EventRow key={item.id} item={item} first={idx === 0} areas={areas} onPress={() => openEdit(item.id)} />
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={{ marginTop: spacing.xl }}>
            <AgendaView groups={agenda} areas={areas} onEdit={openEdit} />
          </View>
        )}

        {couple?.wedding_date_status === 'UNDECIDED' ? (
          <View style={{
            marginTop: spacing.xxxl, padding: spacing.lg,
            borderWidth: 1, borderColor: colors.lineStrong, borderStyle: 'dashed', borderRadius: 10,
          }}>
            <Text variant="caption" color="inkMuted">예식일을 아직 정하지 않으셨나요?</Text>
            <Text variant="body" color="inkMuted" style={{ marginTop: spacing.sm }}>
              날짜를 입력하지 않아도 일정을 자유롭게 기록할 수 있어요.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <Fab label="일정 추가" onPress={openAdd} />

      <ScheduleForm
        key={formKey}
        visible={formOpen}
        areas={areas}
        editing={editing}
        defaultAreaId={null}
        onSubmit={submitForm}
        onDelete={editing ? deleteCurrent : undefined}
        onClose={closeForm}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: 타입체크 + 린트**

```bash
npx tsc --noEmit
npx eslint src
```

Expected: 둘 다 0에러/0건.

- [ ] **Step 3: 커밋**

```bash
git add "src/app/(tabs)/schedule.tsx"
git commit -m "$(cat <<'EOF'
feat(schedule): 일정 화면 실구현 — 캘린더/리스트 뷰 전환 + CRUD

design/schedule.html 구조를 이식. 캘린더 뷰는 날짜 탭 시 하단 상세가 바뀌고
(사용자 결정 2026-11-08), 리스트 뷰는 날짜 그룹 아젠다. D-day는 선택적
(wedding_date_status가 UNDECIDED면 미정 안내 패널). FAB로 추가, 행 탭으로 수정.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 최종 검증

**Files:** 없음(검증 전용) — 필요 시 「아키텍처」/HANDOFF 갱신.

- [ ] **Step 1: 정적 검증**

```bash
npx tsc --noEmit
npm test
npx eslint src
```

Expected: 전부 0에러/통과.

- [ ] **Step 2: 런타임 CRUD 경계 실측(웹 또는 기기)**

`npx expo start --web`(또는 기기)로 실행, 일정 탭 진입:

1. 빈 목록 상태에서 FAB로 첫 일정 추가(날짜 있는 것 1개 + 날짜 미정인 것 1개) → 캘린더 뷰에
   마커가 뜨는지, 리스트 뷰에서 "날짜 미정" 그룹이 맨 뒤에 뜨는지 확인.
2. 캘린더에서 날짜 탭 → 하단 상세 리스트가 그 날짜로 바뀌는지, 월 이동(‹›) 확인.
3. 중간 항목 수정(제목·날짜·시간·장소·담당·분류 전부 한 번씩 바꿔보고 저장 후 반영 확인).
4. 마지막 항목 삭제 → 빈 상태 문구 복귀 확인.
5. `wedding_date_status`가 `UNDECIDED`인 커플로(설정 화면 또는 온보딩 시)에서 D-day 대신 미정
   안내 패널이 뜨는지 확인(FIXED 커플이면 이 케이스는 설정에서 날짜를 지워 임시 확인 후 복원).

- [ ] **Step 3: Realtime 양방향 실측**

웹탭 2개(또는 웹+기기)를 같은 공유 코드로 열고, 한쪽에서 일정을 추가/수정/삭제 → 다른 쪽에
Broadcast로 반영되는지 확인. 낙관적 반영(쓴 쪽은 즉시 보임)과 실패 롤백(예: 네트워크 끄고 저장
시도 → 되돌아가는지) 1건씩 확인.

- [ ] **Step 4: 함정 재확인(문서 반영)**

실측 중 CLAUDE.md의 「아키텍처 — 비자명한 부분」에 없는 새 함정을 발견하면(예: CalendarView의
onLayout 이슈, 날짜 탭 상태와 월 이동 상호작용 등) 그 자리에서 CLAUDE.md에 추가한다. 없으면 이
Step은 스킵.

- [ ] **Step 5: 슬라이스 커밋 마무리 + 문서 갱신**

`CLAUDE.md`의 「현재 상태」에 일정 화면 완료를 반영(체크리스트 항목이 했던 것과 동일한 형식 —
화면 구조·주요 패턴 요약)하고, `HANDOFF.md`의 0·2번을 "다음은 비용(budget) 화면"으로 갱신한다.

```bash
git add CLAUDE.md HANDOFF.md
git commit -m "$(cat <<'EOF'
docs: 일정 화면 완료 반영 — 현재 상태·HANDOFF 다음 작업을 비용 화면으로 갱신

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

이후 **비용(budget) → 홈** 순으로 Phase 1이 이어진다(HANDOFF.md 참고).

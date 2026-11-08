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

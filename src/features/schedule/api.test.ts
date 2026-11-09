import type { Area, CoupleSnapshot, ScheduleEvent } from '@/types/db';
import {
  selectAgenda, selectAgendaByArea, selectDDay, selectEventsOnDate, selectEventStatusChip,
  selectMarkersByDate, selectSchedule, toTimelineItem,
} from './api';

const ev = (id: string, date: string | null, opts: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id, created_at: '', couple_id: 'c1', area_id: null, title: id, event_date: date,
  event_time: null, location: null, assignee: null, category: 'EVENT', reminder_at: null, origin: 'USER',
  ...opts,
});

const area = (id: string, nameKo: string, sortOrder: number): Area => ({
  id, created_at: '', code: 'SDM', name_ko: nameKo, sort_order: sortOrder,
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

describe('selectAgendaByArea', () => {
  const hall = area('hall', '웨딩홀', 1);
  const inv = area('inv', '청첩장', 2);

  test('영역별 그룹, area.sort_order 순, 그룹 내 날짜→시간 오름차순', () => {
    const events = [
      ev('invLate', '2026-11-11', { area_id: 'inv', event_time: '15:00:00' }),
      ev('hallEarly', '2026-11-10', { area_id: 'hall', event_time: '09:00:00' }),
      ev('invEarly', '2026-11-10', { area_id: 'inv', event_time: '09:00:00' }),
    ];
    const out = selectAgendaByArea(events, [inv, hall]);
    expect(out.map((g) => g.area?.id)).toEqual(['hall', 'inv']);
    expect(out[1].items.map((i) => i.id)).toEqual(['invEarly', 'invLate']);
  });

  test('일정이 하나도 없는 영역은 결과에서 제외', () => {
    const events = [ev('a', '2026-11-10', { area_id: 'hall' })];
    const out = selectAgendaByArea(events, [inv, hall]);
    expect(out.map((g) => g.area?.id)).toEqual(['hall']);
  });

  test('area_id가 null인 일정은 맨 뒤 "영역 없음"(area: null) 그룹', () => {
    const events = [
      ev('withArea', '2026-11-10', { area_id: 'hall' }),
      ev('noArea', '2026-11-10', { area_id: null }),
    ];
    const out = selectAgendaByArea(events, [hall]);
    expect(out[out.length - 1].area).toBeNull();
    expect(out[out.length - 1].items.map((i) => i.id)).toEqual(['noArea']);
  });

  test('area_id null인 일정이 없으면 "영역 없음" 그룹 자체가 없다', () => {
    const events = [ev('a', '2026-11-10', { area_id: 'hall' })];
    const out = selectAgendaByArea(events, [hall]);
    expect(out.every((g) => g.area !== null)).toBe(true);
  });

  test('빈 목록은 빈 배열', () => {
    expect(selectAgendaByArea([], [hall])).toEqual([]);
  });

  test('원본 배열 불변', () => {
    const events = [ev('a', '2026-11-10', { area_id: 'hall' })];
    selectAgendaByArea(events, [hall]);
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

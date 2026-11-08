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

import type { ChecklistItem, Couple, CoupleSnapshot, Guest, ScheduleEvent } from '@/types/db';
import { formatWeddingMeta, selectGiftTotal, selectUpcomingFeed } from './api';

const chk = (id: string, date: string | null, isDone = false, opts: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', title: id, assignee: 'ME',
  is_done: isDone, done_at: null, due_date: date, memo: null, origin: 'USER', sort_order: 0, ...opts,
});

const ev = (id: string, date: string | null, opts: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id, created_at: '', couple_id: 'c1', area_id: null, title: id, event_date: date,
  event_time: null, location: null, assignee: null, category: 'EVENT', reminder_at: null, origin: 'USER', ...opts,
});

const snap = (checklist: ChecklistItem[], events: ScheduleEvent[]): CoupleSnapshot =>
  ({ checklist_items: checklist, schedule_events: events } as CoupleSnapshot);

describe('selectUpcomingFeed', () => {
  test('미완료 체크리스트 + 일정을 날짜 오름차순으로 병합', () => {
    const out = selectUpcomingFeed(
      snap([chk('c1', '2026-12-01')], [ev('e1', '2026-11-01')]),
      10,
    );
    expect(out.map((i) => i.item.id)).toEqual(['e1', 'c1']);
    expect(out.map((i) => i.kind)).toEqual(['EVENT', 'CHECKLIST']);
  });

  test('완료된 체크리스트는 제외(일정은 완료 개념 없이 전부 포함)', () => {
    const out = selectUpcomingFeed(
      snap([chk('done', '2026-11-01', true), chk('todo', '2026-11-02')], [ev('e1', '2026-11-03')]),
      10,
    );
    expect(out.map((i) => i.item.id)).toEqual(['todo', 'e1']);
  });

  test('날짜 미정(null)은 맨 뒤', () => {
    const out = selectUpcomingFeed(
      snap([chk('noDate', null)], [ev('dated', '2026-11-01'), ev('noDateEv', null)]),
      10,
    );
    expect(out[0].item.id).toBe('dated');
    expect(out.slice(1).map((i) => i.item.id).sort()).toEqual(['noDate', 'noDateEv']);
  });

  test('상위 limit개만 반환(날짜순 앞에서부터)', () => {
    const out = selectUpcomingFeed(
      snap(
        [chk('c-a', '2026-11-04'), chk('c-b', '2026-11-02')],
        [ev('e-a', '2026-11-01'), ev('e-b', '2026-11-03')],
      ),
      2,
    );
    expect(out.map((i) => i.item.id)).toEqual(['e-a', 'c-b']);
  });

  test('과거(지남) 항목도 포함하며 날짜순이라 맨 위에 온다', () => {
    const out = selectUpcomingFeed(
      snap([chk('past', '2020-01-01')], [ev('future', '2030-01-01')]),
      10,
    );
    expect(out.map((i) => i.item.id)).toEqual(['past', 'future']);
  });

  test('limit 기본값은 4', () => {
    const items = Array.from({ length: 6 }, (_, i) => chk(`c${i}`, `2026-11-0${i + 1}`));
    expect(selectUpcomingFeed(snap(items, [])).length).toBe(4);
  });

  describe('병리/경계', () => {
    test('빈 입력은 빈 배열', () => {
      expect(selectUpcomingFeed(snap([], []), 10)).toEqual([]);
    });

    test('모두 완료된 체크리스트 + 일정 없음 → 빈 배열', () => {
      expect(selectUpcomingFeed(snap([chk('a', '2026-11-01', true)], []), 10)).toEqual([]);
    });

    test('원본 배열 불변(정렬·필터가 스냅샷을 건드리지 않음)', () => {
      const checklist = [chk('b', '2026-12-01'), chk('a', '2026-11-01')];
      const events = [ev('z', '2026-11-15')];
      const s = snap(checklist, events);
      selectUpcomingFeed(s, 10);
      expect(s.checklist_items.map((i) => i.id)).toEqual(['b', 'a']);
      expect(s.schedule_events.map((i) => i.id)).toEqual(['z']);
    });
  });
});

const couple = (opts: Partial<Couple> = {}): Couple => ({
  id: 'c1', created_at: '', share_code: 'ABCD1234', groom_name: '지훈', bride_name: '예은',
  wedding_date: '2027-05-15', wedding_date_status: 'FIXED', wedding_time: '13:00:00',
  venue: '그랜드컨벤션 그랜드홀', show_auspicious_days: true, notify_payments: true, total_budget: 0,
  meal_price: 0,
  ...opts,
});

describe('formatWeddingMeta', () => {
  test('날짜(요일)+오후 시간+장소를 한 줄로 합친다', () => {
    expect(formatWeddingMeta(couple())).toBe('2027. 5. 15 (토) 오후 1시 · 그랜드컨벤션 그랜드홀');
  });

  test('정오(12시)는 오후 12시', () => {
    expect(formatWeddingMeta(couple({ wedding_time: '12:00:00' }))).toContain('오후 12시');
  });

  test('자정(0시)은 오전 12시', () => {
    expect(formatWeddingMeta(couple({ wedding_time: '00:00:00' }))).toContain('오전 12시');
  });

  test('분이 0이 아니면 "N시 M분"', () => {
    expect(formatWeddingMeta(couple({ wedding_time: '09:30:00' }))).toContain('오전 9시 30분');
  });

  test('시간이 없으면 날짜만', () => {
    expect(formatWeddingMeta(couple({ wedding_time: null }))).toBe('2027. 5. 15 (토) · 그랜드컨벤션 그랜드홀');
  });

  test('장소가 없으면 장소 생략', () => {
    expect(formatWeddingMeta(couple({ venue: null }))).toBe('2027. 5. 15 (토) 오후 1시');
  });

  test('UNDECIDED면 null', () => {
    expect(formatWeddingMeta(couple({ wedding_date_status: 'UNDECIDED' }))).toBeNull();
  });

  test('wedding_date가 없으면 null(상태와 무관)', () => {
    expect(formatWeddingMeta(couple({ wedding_date: null, wedding_date_status: 'APPROX' }))).toBeNull();
  });
});

const guest = (id: string, giftAmount: number | null, opts: Partial<Guest> = {}): Guest => ({
  id, created_at: '', couple_id: 'c1', name: id, side: 'GROOM', relation: 'FRIEND',
  attend_status: 'ATTENDING', is_host: false, meal_count: 1, gift_amount: giftAmount, memo: null,
  ...opts,
});

const snapWithGuests = (guests: Guest[]): CoupleSnapshot => ({ guests } as CoupleSnapshot);

describe('selectGiftTotal', () => {
  test('여러 하객의 축의금을 합산', () => {
    expect(selectGiftTotal(snapWithGuests([guest('a', 100000), guest('b', 200000)]))).toBe(300000);
  });

  test('gift_amount=null(미접수)은 0으로 취급해 합산에서 제외', () => {
    expect(selectGiftTotal(snapWithGuests([guest('a', 100000), guest('b', null)]))).toBe(100000);
  });

  test('전부 미접수면 0', () => {
    expect(selectGiftTotal(snapWithGuests([guest('a', null), guest('b', null)]))).toBe(0);
  });

  describe('병리/경계', () => {
    test('하객 0명이면 0', () => {
      expect(selectGiftTotal(snapWithGuests([]))).toBe(0);
    });

    test('혼주(is_host=true, gift_amount=null인 경우가 보통)는 null이라 자연히 제외', () => {
      expect(selectGiftTotal(snapWithGuests([
        guest('host', null, { is_host: true }),
        guest('a', 500000),
      ]))).toBe(500000);
    });
  });
});

import type {
  Area, ChecklistItem, CoupleSnapshot, Expense, Guest, Photo, ScheduleEvent, Vendor,
} from '@/types/db';
import { groupByArea } from '@/features/checklist/api';
import { selectVendorsByArea } from '@/features/vendors/api';
import { selectAreaBreakdown } from '@/features/budget/api';
import { selectPhotosByArea } from '@/features/gallery/api';
import { selectGuestSummary } from '@/features/guests/api';
import { selectAreaOverviews } from './api';

const area = (id: string, order: number, code: Area['code'] = 'SDM', name = id): Area => ({
  id, created_at: '', code, name_ko: name, sort_order: order,
});
const item = (id: string, areaId: string, done = false): ChecklistItem => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, title: id, assignee: 'BOTH',
  is_done: done, done_at: done ? '2026-01-01T00:00:00Z' : null, due_date: null, memo: null,
  origin: 'USER', sort_order: 0,
});
const event = (id: string, areaId: string | null, date: string | null): ScheduleEvent => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, title: id, event_date: date,
  event_time: null, location: null, assignee: null, category: 'EVENT', reminder_at: null, origin: 'USER',
});
const vendor = (id: string, areaId: string): Vendor => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, name: id, status: 'CANDIDATE',
  role: null, location: null, contract_date: null, quoted_price: null, memo: null,
});
const expense = (id: string, areaId: string, base: number): Expense => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, vendor_id: null, title: id, base_amount: base,
});
const guest = (id: string, extra: Partial<Guest> = {}): Guest => ({
  id, created_at: '', couple_id: 'c1', name: id, side: 'GROOM', relation: 'FRIEND',
  attend_status: 'ATTENDING', is_host: false, meal_count: 1, gift_amount: null, memo: null, ...extra,
});
const photo = (id: string, areaId: string | null): Photo => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, storage_path: `${id}.jpg`, external_url: null,
  is_video: false, caption: null, taken_at: null, size_bytes: 0,
});

const snap = (p: Partial<CoupleSnapshot> = {}): CoupleSnapshot => ({
  couple: { meal_price: 0 } as CoupleSnapshot['couple'],
  checklist_items: [], schedule_events: [], vendors: [], expenses: [], expense_options: [],
  expense_splits: [], payments: [], area_budgets: [], guests: [], photos: [],
  ...p,
} as CoupleSnapshot);

const areas = [area('a2', 2, 'HALL', '웨딩홀'), area('a1', 1, 'SDM', '스드메'), area('g1', 6, 'GUEST', '하객')];

describe('selectAreaOverviews', () => {
  test('area sort_order 순으로 전부 반환(데이터 없는 영역도 포함)', () => {
    const out = selectAreaOverviews(snap(), areas, '2026-01-01');
    expect(out.map((o) => o.area.id)).toEqual(['a1', 'a2', 'g1']);
  });

  test('체크리스트 집계는 checklist/api.groupByArea와 동일 결과', () => {
    const items = [item('i1', 'a1', true), item('i2', 'a1', false)];
    const out = selectAreaOverviews(snap({ checklist_items: items }), areas, '2026-01-01');
    const expected = groupByArea(items, areas);
    expect(out.map((o) => o.checklist)).toEqual(expected);
  });

  test('업체 집계는 vendors/api.selectVendorsByArea와 동일 결과', () => {
    const vendors = [vendor('v1', 'a1')];
    const out = selectAreaOverviews(snap({ vendors }), areas, '2026-01-01');
    const expected = selectVendorsByArea(snap({ vendors }), areas);
    expect(out.map((o) => o.vendor)).toEqual(expected);
  });

  test('사진 집계는 gallery/api.selectPhotosByArea와 동일 결과', () => {
    const photos = [photo('p1', 'a1'), photo('p2', null)];
    const out = selectAreaOverviews(snap({ photos }), areas, '2026-01-01');
    const expected = selectPhotosByArea(snap({ photos }), areas);
    expect(out.map((o) => o.photos)).toEqual(expected.map((g) => g.photos));
  });

  test('GUEST 영역: cost는 null, guestSummary는 selectGuestSummary와 동일 — 다른 영역은 반대', () => {
    const guests = [guest('g1', { gift_amount: 50000 })];
    const s = snap({ guests, expenses: [expense('e1', 'a1', 1000)] });
    const out = selectAreaOverviews(s, areas, '2026-01-01');
    const guestArea = out.find((o) => o.area.code === 'GUEST')!;
    const sdmArea = out.find((o) => o.area.code === 'SDM')!;

    expect(guestArea.cost).toBeNull();
    expect(guestArea.guestSummary).toEqual(selectGuestSummary(s));
    expect(sdmArea.guestSummary).toBeNull();
    expect(sdmArea.cost).toEqual(selectAreaBreakdown(s, areas).find((b) => b.area.id === 'a1'));
  });

  test('일정: 영역에 속하고 오늘 이후 날짜인 것만, 날짜 오름차순, 상위 3개로 제한', () => {
    const events = [
      event('future2', 'a1', '2026-03-01'),
      event('past', 'a1', '2025-12-01'), // 과거 제외
      event('noDate', 'a1', null), // 날짜 없음 제외
      event('future1', 'a1', '2026-02-01'),
      event('future3', 'a1', '2026-04-01'),
      event('future4', 'a1', '2026-05-01'), // 4번째라 제외(상위 3개)
      event('otherArea', 'a2', '2026-02-15'),
    ];
    const out = selectAreaOverviews(snap({ schedule_events: events }), areas, '2026-01-01');
    const sdm = out.find((o) => o.area.id === 'a1')!;
    expect(sdm.schedule.map((e) => e.id)).toEqual(['future1', 'future2', 'future3']);
  });

  test('경계: 오늘 날짜인 일정도 포함(오늘 이후 ≥ today)', () => {
    const events = [event('today', 'a1', '2026-01-01')];
    const out = selectAreaOverviews(snap({ schedule_events: events }), areas, '2026-01-01');
    expect(out.find((o) => o.area.id === 'a1')!.schedule.map((e) => e.id)).toEqual(['today']);
  });
});

import type { CoupleSnapshot, Guest } from '@/types/db';
import {
  groupByRelation, selectGiftTotal, selectGuestSummary, selectGuests, selectSideSummary,
} from './api';

const guest = (id: string, extra: Partial<Guest> = {}): Guest => ({
  id, created_at: '', couple_id: 'c1', name: id, side: 'GROOM', relation: 'FRIEND',
  attend_status: 'ATTENDING', is_host: false, meal_count: 1, gift_amount: null, memo: null,
  ...extra,
});
const snap = (guests: Guest[], mealPrice = 0): CoupleSnapshot =>
  ({ guests, couple: { meal_price: mealPrice } as CoupleSnapshot['couple'] } as CoupleSnapshot);

describe('selectGuests', () => {
  test('스냅샷의 guests를 그대로(새 배열로) 반환, 원본 불변', () => {
    const s = snap([guest('a')]);
    const out = selectGuests(s);
    expect(out).toEqual(s.guests);
    expect(out).not.toBe(s.guests);
  });
});

describe('selectGuestSummary', () => {
  test('경계: 하객 0명 → 전부 0', () => {
    const out = selectGuestSummary(snap([], 50000));
    expect(out).toEqual({
      total: 0, attending: 0, maybe: 0, absent: 0,
      mealCount: 0, mealPrice: 50000, mealTotal: 0, giftTotal: 0, giftCount: 0,
    });
  });

  test('경계: 하객 1명(참석, 축의금 있음)', () => {
    const out = selectGuestSummary(snap([
      guest('a', { attend_status: 'ATTENDING', meal_count: 2, gift_amount: 50000 }),
    ], 10000));
    expect(out).toEqual({
      total: 1, attending: 1, maybe: 0, absent: 0,
      mealCount: 2, mealPrice: 10000, mealTotal: 20000, giftTotal: 50000, giftCount: 1,
    });
  });

  test('식대 = 참석 확정 인원의 meal_count 합 × 단가 — 미정/불참은 식사 집계 제외', () => {
    const out = selectGuestSummary(snap([
      guest('a', { attend_status: 'ATTENDING', meal_count: 2 }),
      guest('b', { attend_status: 'MAYBE', meal_count: 5 }),
      guest('c', { attend_status: 'ABSENT', meal_count: 5 }),
    ], 10000));
    expect(out.mealCount).toBe(2);
    expect(out.mealTotal).toBe(20000);
    expect(out.attending).toBe(1);
    expect(out.maybe).toBe(1);
    expect(out.absent).toBe(1);
  });

  test('혼주는 gift_amount가 null이라 자연히 축의금 집계에서 제외', () => {
    const out = selectGuestSummary(snap([
      guest('host', { is_host: true, gift_amount: null }),
      guest('guest', { is_host: false, gift_amount: 30000 }),
    ]));
    expect(out.giftTotal).toBe(30000);
    expect(out.giftCount).toBe(1);
  });

  test('경계: 혼주만 있는 경우 → 축의금 집계 0', () => {
    const out = selectGuestSummary(snap([guest('host', { is_host: true, gift_amount: null })]));
    expect(out.giftTotal).toBe(0);
    expect(out.giftCount).toBe(0);
    expect(out.total).toBe(1);
  });

  test('gift_amount 0은 접수 건수로 집계(null과 구분)', () => {
    const out = selectGuestSummary(snap([guest('a', { gift_amount: 0 })]));
    expect(out.giftTotal).toBe(0);
    expect(out.giftCount).toBe(1);
  });
});

describe('groupByRelation', () => {
  test('RELATION_ORDER(FAMILY/FRIEND/WORK/ACQUAINTANCE) 순으로 그룹, 빈 관계는 제외', () => {
    const guests = [
      guest('a', { relation: 'WORK' }),
      guest('b', { relation: 'FAMILY' }),
      guest('c', { relation: 'FAMILY' }),
    ];
    const out = groupByRelation(guests);
    expect(out.map((s) => s.relation)).toEqual(['FAMILY', 'WORK']); // FRIEND·ACQUAINTANCE는 0건이라 제외
    expect(out[0]).toMatchObject({ count: 2 });
    expect(out[1]).toMatchObject({ count: 1 });
  });

  test('경계: 하객 0명 → 빈 배열', () => {
    expect(groupByRelation([])).toEqual([]);
  });
});

describe('selectSideSummary', () => {
  test('해당 측 인원 수 + 축의금 합', () => {
    const guests = [
      guest('a', { side: 'GROOM', gift_amount: 10000 }),
      guest('b', { side: 'GROOM', gift_amount: 20000 }),
      guest('c', { side: 'BRIDE', gift_amount: 5000 }),
    ];
    expect(selectSideSummary(guests, 'GROOM')).toEqual({ side: 'GROOM', count: 2, giftTotal: 30000 });
    expect(selectSideSummary(guests, 'BRIDE')).toEqual({ side: 'BRIDE', count: 1, giftTotal: 5000 });
  });

  test('경계: 해당 측 인원 없음 → count 0, giftTotal 0', () => {
    const guests = [guest('a', { side: 'BRIDE' })];
    expect(selectSideSummary(guests, 'GROOM')).toEqual({ side: 'GROOM', count: 0, giftTotal: 0 });
  });

  test('gift_amount null은 0으로 취급해 합산', () => {
    const guests = [guest('a', { side: 'GROOM', gift_amount: null }), guest('b', { side: 'GROOM', gift_amount: 10000 })];
    expect(selectSideSummary(guests, 'GROOM').giftTotal).toBe(10000);
  });
});

describe('selectGiftTotal', () => {
  test('전체 축의금 접수분 합(혼주 null 자연 제외)', () => {
    const s = snap([
      guest('a', { gift_amount: 10000 }),
      guest('host', { is_host: true, gift_amount: null }),
      guest('b', { gift_amount: 20000 }),
    ]);
    expect(selectGiftTotal(s)).toBe(30000);
  });

  test('경계: 하객 0명 → 0', () => {
    expect(selectGiftTotal(snap([]))).toBe(0);
  });
});

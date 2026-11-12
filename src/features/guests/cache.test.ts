import type { CoupleSnapshot, Guest } from '@/types/db';
import {
  applyCreate, applyDelete, applyImport, applyMealPrice, applySetAttend, applyUpdate,
} from './cache';

const guest = (id: string, extra: Partial<Guest> = {}): Guest => ({
  id, created_at: '', couple_id: 'c1', name: id, side: 'GROOM', relation: 'FRIEND',
  attend_status: 'ATTENDING', is_host: false, meal_count: 1, gift_amount: null, memo: null,
  ...extra,
});
const snap = (guests: Guest[], mealPrice = 0): CoupleSnapshot =>
  ({ guests, couple: { meal_price: mealPrice } as CoupleSnapshot['couple'] } as CoupleSnapshot);

describe('applyCreate', () => {
  test('맨 뒤에 추가, 나머지 보존', () => {
    const s0 = snap([guest('a')]);
    const out = applyCreate(s0, guest('b'));
    expect(out.guests.map((g) => g.id)).toEqual(['a', 'b']);
    expect(s0.guests).toHaveLength(1); // 원본 불변
  });
});

describe('applyUpdate', () => {
  test('지정 필드만 교체, 나머지 보존', () => {
    const s0 = snap([guest('a', { name: '원래이름' })]);
    const out = applyUpdate(s0, {
      id: 'a', name: '새이름', side: 'BRIDE', relation: 'FAMILY', attendStatus: 'MAYBE',
      isHost: true, mealCount: 3, giftAmount: 50000, memo: '메모',
    });
    expect(out.guests[0]).toMatchObject({
      name: '새이름', side: 'BRIDE', relation: 'FAMILY', attend_status: 'MAYBE',
      is_host: true, meal_count: 3, gift_amount: 50000, memo: '메모',
    });
    expect(s0.guests[0].name).toBe('원래이름'); // 원본 불변
  });

  test('giftAmount/memo 미지정(undefined)이면 null로 정규화', () => {
    const out = applyUpdate(snap([guest('a')]), {
      id: 'a', name: 'x', side: 'GROOM', relation: 'FRIEND', attendStatus: 'ATTENDING',
      isHost: false, mealCount: 1,
    });
    expect(out.guests[0].gift_amount).toBeNull();
    expect(out.guests[0].memo).toBeNull();
  });

  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([guest('a')]);
    const out = applyUpdate(s0, {
      id: 'zzz', name: 'x', side: 'GROOM', relation: 'FRIEND', attendStatus: 'ATTENDING',
      isHost: false, mealCount: 1,
    });
    expect(out.guests).toEqual(s0.guests);
  });
});

describe('applyDelete', () => {
  test('해당 id 제거, 나머지 보존', () => {
    const out = applyDelete(snap([guest('a'), guest('b')]), 'a');
    expect(out.guests.map((g) => g.id)).toEqual(['b']);
  });
  test('병리: 없는 id는 개수 불변', () => {
    expect(applyDelete(snap([guest('a')]), 'zzz').guests).toHaveLength(1);
  });
});

describe('applySetAttend', () => {
  test('해당 id의 attend_status만 변경', () => {
    const s0 = snap([guest('a', { attend_status: 'MAYBE' }), guest('b', { attend_status: 'MAYBE' })]);
    const out = applySetAttend(s0, 'a', 'ATTENDING');
    expect(out.guests[0].attend_status).toBe('ATTENDING');
    expect(out.guests[1].attend_status).toBe('MAYBE'); // 보존
    expect(s0.guests[0].attend_status).toBe('MAYBE'); // 원본 불변
  });
  test('멱등성: 같은 상태로 두 번 설정해도 결과 동일', () => {
    const s0 = snap([guest('a', { attend_status: 'MAYBE' })]);
    const s1 = applySetAttend(s0, 'a', 'ABSENT');
    const s2 = applySetAttend(s1, 'a', 'ABSENT');
    expect(s2).toEqual(s1);
  });
  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([guest('a')]);
    expect(applySetAttend(s0, 'zzz', 'ABSENT').guests).toEqual(s0.guests);
  });
});

describe('applyImport', () => {
  test('벌크 append — 기존 보존 + 전체 추가(개수 보존)', () => {
    const s0 = snap([guest('a')]);
    const out = applyImport(s0, [guest('b'), guest('c')]);
    expect(out.guests.map((g) => g.id)).toEqual(['a', 'b', 'c']);
    expect(s0.guests).toHaveLength(1); // 원본 불변
  });
  test('빈 배열 import는 무변경', () => {
    const s0 = snap([guest('a')]);
    expect(applyImport(s0, []).guests).toEqual(s0.guests);
  });
});

describe('applyMealPrice', () => {
  test('couple.meal_price만 교체, 나머지 보존', () => {
    const s0 = snap([guest('a')], 10000);
    const out = applyMealPrice(s0, 20000);
    expect(out.couple.meal_price).toBe(20000);
    expect(out.guests).toEqual(s0.guests);
    expect(s0.couple.meal_price).toBe(10000); // 원본 불변
  });
});

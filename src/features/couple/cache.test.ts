import type { CoupleSnapshot } from '@/types/db';
import type { UpdateCoupleInput } from './api';
import { applyUpdateCouple } from './cache';

const snap = (): CoupleSnapshot =>
  ({
    couple: {
      id: 'c1', created_at: '', share_code: 'old-code', groom_name: '지훈', bride_name: '예은',
      wedding_date: null, wedding_date_status: 'UNDECIDED', wedding_time: null, venue: null,
      show_auspicious_days: true, notify_payments: true, total_budget: 0, meal_price: 0,
    },
  } as CoupleSnapshot);

const patch: UpdateCoupleInput = {
  groomName: '민준', brideName: '서연', weddingDate: '2027-05-15', weddingDateStatus: 'FIXED',
  weddingTime: '13:00', venue: '그랜드컨벤션', notifyPayments: false,
};

describe('applyUpdateCouple', () => {
  test('couple 슬라이스의 지정 필드만 교체, 나머지(id·share_code·show_auspicious_days)는 보존', () => {
    const out = applyUpdateCouple(snap(), patch);
    expect(out.couple).toEqual({
      id: 'c1', created_at: '', share_code: 'old-code',
      groom_name: '민준', bride_name: '서연', wedding_date: '2027-05-15', wedding_date_status: 'FIXED',
      wedding_time: '13:00', venue: '그랜드컨벤션',
      show_auspicious_days: true, notify_payments: false, total_budget: 0, meal_price: 0,
    });
  });

  test('원본 스냅샷은 불변(새 객체 반환)', () => {
    const s = snap();
    const out = applyUpdateCouple(s, patch);
    expect(out).not.toBe(s);
    expect(s.couple.groom_name).toBe('지훈'); // 원본 보존
  });
});

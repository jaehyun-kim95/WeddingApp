import type { CoupleSnapshot } from '@/types/db';
import type { UpdateCoupleInput } from './api';

// 스냅샷 캐시 낙관적 패치(순수·불변). couple 슬라이스만 교체하고 나머지는 그대로 둔다
// (guests/cache.ts의 applyMealPrice와 동일 패턴).
export function applyUpdateCouple(s: CoupleSnapshot, patch: UpdateCoupleInput): CoupleSnapshot {
  return {
    ...s,
    couple: {
      ...s.couple,
      groom_name: patch.groomName,
      bride_name: patch.brideName,
      wedding_date: patch.weddingDate,
      wedding_date_status: patch.weddingDateStatus,
      wedding_time: patch.weddingTime,
      venue: patch.venue,
      notify_payments: patch.notifyPayments,
    },
  };
}

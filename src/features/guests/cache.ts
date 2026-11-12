import type { AttendStatus, CoupleSnapshot, Guest } from '@/types/db';
import type { UpdateGuestInput } from './api';

// 스냅샷 캐시 낙관적 패치(순수·불변). CoupleSnapshot을 받아 새 스냅샷을 반환한다.
// 각 함수는 guests(또는 couple.meal_price) 슬라이스만 교체하고 나머지는 그대로 둔다.

function withGuests(s: CoupleSnapshot, guests: Guest[]): CoupleSnapshot {
  return { ...s, guests };
}

export function applyCreate(s: CoupleSnapshot, guest: Guest): CoupleSnapshot {
  return withGuests(s, [...s.guests, guest]);
}

export function applyUpdate(s: CoupleSnapshot, patch: UpdateGuestInput): CoupleSnapshot {
  return withGuests(
    s,
    s.guests.map((g) =>
      g.id === patch.id
        ? {
            ...g,
            name: patch.name,
            side: patch.side,
            relation: patch.relation,
            attend_status: patch.attendStatus,
            is_host: patch.isHost,
            meal_count: patch.mealCount,
            gift_amount: patch.giftAmount ?? null,
            memo: patch.memo ?? null,
          }
        : g,
    ),
  );
}

export function applyDelete(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return withGuests(s, s.guests.filter((g) => g.id !== id));
}

export function applySetAttend(s: CoupleSnapshot, id: string, status: AttendStatus): CoupleSnapshot {
  return withGuests(
    s,
    s.guests.map((g) => (g.id === id ? { ...g, attend_status: status } : g)),
  );
}

// 엑셀 일괄 가져오기 — 벌크 append(전체 보존).
export function applyImport(s: CoupleSnapshot, guests: Guest[]): CoupleSnapshot {
  return withGuests(s, [...s.guests, ...guests]);
}

export function applyMealPrice(s: CoupleSnapshot, amount: number): CoupleSnapshot {
  return { ...s, couple: { ...s.couple, meal_price: amount } };
}

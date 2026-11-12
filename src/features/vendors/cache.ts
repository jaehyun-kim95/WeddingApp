import type { CoupleSnapshot, Vendor } from '@/types/db';
import type { UpdateVendorInput } from './api';

// 스냅샷 캐시 낙관적 패치(순수·불변). CoupleSnapshot을 받아 새 스냅샷을 반환한다.
// 각 함수는 vendors 슬라이스만 교체하고 나머지는 그대로 둔다.

function withVendors(s: CoupleSnapshot, vendors: Vendor[]): CoupleSnapshot {
  return { ...s, vendors };
}

export function applyCreate(s: CoupleSnapshot, vendor: Vendor): CoupleSnapshot {
  return withVendors(s, [...s.vendors, vendor]);
}

export function applyUpdate(s: CoupleSnapshot, patch: UpdateVendorInput): CoupleSnapshot {
  return withVendors(
    s,
    s.vendors.map((v) =>
      v.id === patch.id
        ? {
            ...v,
            name: patch.name,
            status: patch.status,
            role: patch.role ?? null,
            location: patch.location ?? null,
            contract_date: patch.contractDate ?? null,
            quoted_price: patch.quotedPrice ?? null,
            memo: patch.memo ?? null,
          }
        : v,
    ),
  );
}

export function applyDelete(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return withVendors(s, s.vendors.filter((v) => v.id !== id));
}

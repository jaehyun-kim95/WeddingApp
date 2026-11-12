import type { Area, CoupleSnapshot, Expense, Vendor } from '@/types/db';
import { findLinkedExpense, selectVendors, selectVendorsByArea } from './api';

const area = (id: string, order: number, name: string, code: Area['code'] = 'HALL'): Area => ({
  id, created_at: '', code, name_ko: name, sort_order: order,
});
const vendor = (id: string, areaId: string, extra: Partial<Vendor> = {}): Vendor => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, name: id, status: 'CANDIDATE',
  role: null, location: null, contract_date: null, quoted_price: null, memo: null,
  ...extra,
});
const expense = (id: string, vendorId: string | null, extra: Partial<Expense> = {}): Expense => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', vendor_id: vendorId, title: vendorId ? null : 'x',
  base_amount: 0, ...extra,
});
const snap = (vendors: Vendor[], expenses: Expense[] = []): CoupleSnapshot =>
  ({ vendors, expenses } as CoupleSnapshot);

describe('selectVendors', () => {
  test('스냅샷의 vendors를 그대로(새 배열로) 반환, 원본 불변', () => {
    const s = snap([vendor('a', 'area1')]);
    const out = selectVendors(s);
    expect(out).toEqual(s.vendors);
    expect(out).not.toBe(s.vendors);
  });
});

describe('selectVendorsByArea', () => {
  test('area sort_order 순, 영역별로 계약/후보 분리', () => {
    const areas = [area('a2', 2, '스드메', 'SDM'), area('a1', 1, '웨딩홀', 'HALL')];
    const vendors = [
      vendor('v1', 'a1', { status: 'CONTRACTED' }),
      vendor('v2', 'a1', { status: 'CANDIDATE' }),
      vendor('v3', 'a2', { status: 'CANDIDATE' }),
    ];
    const out = selectVendorsByArea(snap(vendors), areas);
    expect(out.map((g) => g.area.id)).toEqual(['a1', 'a2']); // sort_order 순
    expect(out[0].contracted.map((v) => v.id)).toEqual(['v1']);
    expect(out[0].candidates.map((v) => v.id)).toEqual(['v2']);
    expect(out[1].contracted).toEqual([]);
    expect(out[1].candidates.map((v) => v.id)).toEqual(['v3']);
  });

  test('경계: 업체 없는 영역도 빈 배열 2개로 포함(화면이 빈 상태 렌더링 여부를 결정)', () => {
    const areas = [area('a1', 1, '신혼집', 'HOME')];
    const out = selectVendorsByArea(snap([]), areas);
    expect(out).toEqual([{ area: areas[0], contracted: [], candidates: [] }]);
  });
});

describe('findLinkedExpense', () => {
  test('vendor_id로 연결된 지출 1건 반환', () => {
    const s = snap([vendor('v1', 'a1')], [expense('e1', 'v1'), expense('e2', null)]);
    expect(findLinkedExpense(s, 'v1')?.id).toBe('e1');
  });
  test('연결된 지출 없으면 null', () => {
    const s = snap([vendor('v1', 'a1')], [expense('e1', 'v2')]);
    expect(findLinkedExpense(s, 'v1')).toBeNull();
  });
});

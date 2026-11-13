import type { Area, CoupleSnapshot, Expense, Vendor } from '@/types/db';
import { findLinkedExpense, hasVisibleVendors, selectVendors, selectVendorsByArea } from './api';

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

  test('여러 업체를 생성 순서 그대로 보존', () => {
    const s = snap([vendor('a', 'area1'), vendor('b', 'area1'), vendor('c', 'area2')]);
    const out = selectVendors(s);
    expect(out.map((v) => v.id)).toEqual(['a', 'b', 'c']);
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

describe('hasVisibleVendors', () => {
  test('전체 필터(null)에서는 어느 영역에든 업체가 있으면 true', () => {
    const areas = [area('a1', 1, '스드메', 'SDM'), area('a2', 2, '웨딩홀', 'HALL')];
    const groups = selectVendorsByArea(snap([vendor('v1', 'a1')]), areas);
    expect(hasVisibleVendors(groups, null)).toBe(true);
  });

  test('업체가 하나도 없으면 전체 필터에서 false', () => {
    const areas = [area('a1', 1, '스드메', 'SDM')];
    const groups = selectVendorsByArea(snap([]), areas);
    expect(hasVisibleVendors(groups, null)).toBe(false);
  });

  test('다른 영역엔 업체가 있어도, 선택한 영역이 비어 있으면 false (재현된 버그)', () => {
    const areas = [area('a1', 1, '스드메', 'SDM'), area('a2', 2, '웨딩홀', 'HALL')];
    const groups = selectVendorsByArea(snap([vendor('v1', 'a1')]), areas);
    expect(hasVisibleVendors(groups, 'a2')).toBe(false);
  });

  test('선택한 영역에 업체가 있으면 true', () => {
    const areas = [area('a1', 1, '스드메', 'SDM'), area('a2', 2, '웨딩홀', 'HALL')];
    const groups = selectVendorsByArea(snap([vendor('v1', 'a1')]), areas);
    expect(hasVisibleVendors(groups, 'a1')).toBe(true);
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

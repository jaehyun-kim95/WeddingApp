import type { CoupleSnapshot, Vendor } from '@/types/db';
import { applyCreate, applyDelete, applyUpdate } from './cache';

const vendor = (id: string, extra: Partial<Vendor> = {}): Vendor => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', name: id, status: 'CANDIDATE',
  role: null, location: null, contract_date: null, quoted_price: null, memo: null,
  ...extra,
});
const snap = (vendors: Vendor[]): CoupleSnapshot => ({ vendors } as CoupleSnapshot);

describe('applyCreate', () => {
  test('맨 뒤에 추가, 나머지 보존', () => {
    const s0 = snap([vendor('a')]);
    const out = applyCreate(s0, vendor('b'));
    expect(out.vendors.map((v) => v.id)).toEqual(['a', 'b']);
    expect(s0.vendors).toHaveLength(1); // 원본 불변
  });
});

describe('applyUpdate', () => {
  test('지정 필드만 교체, 나머지 보존(상태 전환 CANDIDATE→CONTRACTED 포함)', () => {
    const s0 = snap([vendor('a', { status: 'CANDIDATE' })]);
    const out = applyUpdate(s0, {
      id: 'a', name: '새이름', status: 'CONTRACTED', role: 'STUDIO', location: '서울',
      contractDate: '2027-01-01', quotedPrice: 1500000, memo: '메모',
    });
    expect(out.vendors[0]).toMatchObject({
      name: '새이름', status: 'CONTRACTED', role: 'STUDIO', location: '서울',
      contract_date: '2027-01-01', quoted_price: 1500000, memo: '메모',
    });
    expect(s0.vendors[0].status).toBe('CANDIDATE'); // 원본 불변
  });

  test('role/location 등 미지정(undefined)이면 null로 정규화', () => {
    const out = applyUpdate(snap([vendor('a')]), { id: 'a', name: 'x', status: 'CANDIDATE' });
    expect(out.vendors[0].role).toBeNull();
    expect(out.vendors[0].location).toBeNull();
    expect(out.vendors[0].contract_date).toBeNull();
    expect(out.vendors[0].quoted_price).toBeNull();
    expect(out.vendors[0].memo).toBeNull();
  });

  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([vendor('a')]);
    const out = applyUpdate(s0, { id: 'zzz', name: 'x', status: 'CANDIDATE' });
    expect(out.vendors).toEqual(s0.vendors);
  });

  test('해당 id만 교체, 다른 업체는 그대로', () => {
    const s0 = snap([vendor('a', { name: 'a' }), vendor('b', { name: 'b' })]);
    const out = applyUpdate(s0, { id: 'a', name: '수정됨', status: 'CANDIDATE' });
    expect(out.vendors[0].name).toBe('수정됨');
    expect(out.vendors[1]).toEqual(s0.vendors[1]); // 보존
  });

  test('created_at·couple_id·area_id 등 불변 필드는 그대로 보존', () => {
    const s0 = snap([vendor('a', { created_at: '2026-01-01T00:00:00Z', couple_id: 'c9', area_id: 'a9' })]);
    const out = applyUpdate(s0, { id: 'a', name: '새이름', status: 'CONTRACTED' });
    expect(out.vendors[0].created_at).toBe('2026-01-01T00:00:00Z');
    expect(out.vendors[0].couple_id).toBe('c9');
    expect(out.vendors[0].area_id).toBe('a9');
  });

  test('멱등성: 같은 패치를 두 번 적용해도 결과 동일', () => {
    const s0 = snap([vendor('a', { status: 'CANDIDATE' })]);
    const patch = {
      id: 'a', name: '새이름', status: 'CONTRACTED' as const, role: 'STUDIO' as const,
      location: '서울', contractDate: '2027-01-01', quotedPrice: 1500000, memo: '메모',
    };
    const s1 = applyUpdate(s0, patch);
    const s2 = applyUpdate(s1, patch);
    expect(s2.vendors).toEqual(s1.vendors);
  });
});

describe('applyDelete', () => {
  test('해당 id 제거, 나머지 보존', () => {
    const out = applyDelete(snap([vendor('a'), vendor('b')]), 'a');
    expect(out.vendors.map((v) => v.id)).toEqual(['b']);
  });
  test('병리: 없는 id는 개수 불변', () => {
    expect(applyDelete(snap([vendor('a')]), 'zzz').vendors).toHaveLength(1);
  });
});

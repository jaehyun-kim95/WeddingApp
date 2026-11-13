import type { Area, CoupleSnapshot, Expense, Vendor, VendorRole, VendorStatus } from '@/types/db';
import type { AreaVendorGroup } from './types';
import * as rpc from '@/lib/rpc';

// 코어(순수) — RN/expo UI를 import하지 않는다. 셀렉터 + 쓰기 함수(lib/rpc 위임). 업체는 정보
// 관리 전용(ADR-0001) — quoted_price는 참고값, 금액 소스는 expense.

export const ROLE_LABEL: Record<VendorRole, string> = {
  STUDIO: '스튜디오', DRESS: '드레스', MAKEUP: '메이크업',
};
export const STATUS_LABEL: Record<VendorStatus, string> = {
  CANDIDATE: '후보', CONTRACTED: '계약',
};

// 읽기: 스냅샷에서 업체 슬라이스(생성 순 안정 — created_at 그대로, 원본 불변).
export function selectVendors(snapshot: CoupleSnapshot): Vendor[] {
  return [...snapshot.vendors];
}

// 읽기: area.sort_order 순으로 영역별 계약/후보 분리. 업체 없는 영역도 빈 그룹으로 포함
// (화면이 빈 상태를 렌더링할지는 컴포넌트가 결정 — budget의 AreaBreakdown과 동일 패턴).
export function selectVendorsByArea(snapshot: CoupleSnapshot, areas: Area[]): AreaVendorGroup[] {
  return [...areas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => {
      const vendors = snapshot.vendors.filter((v) => v.area_id === area.id);
      return {
        area,
        contracted: vendors.filter((v) => v.status === 'CONTRACTED'),
        candidates: vendors.filter((v) => v.status === 'CANDIDATE'),
      };
    });
}

// 읽기: areaFilter 적용 후에도 보여줄 업체가 하나라도 있는지. 화면의 "업체 추가로 시작하세요"
// 빈 상태는 전체(groups) 기준이 아니라 이 결과로 판단해야 한다 — 그렇지 않으면 다른 영역엔
// 업체가 있는데 선택한 영역만 비어 있을 때 빈 상태 문구도 안 뜨고 아무것도 안 그려진다.
export function hasVisibleVendors(groups: AreaVendorGroup[], areaFilter: string | null): boolean {
  const visible = areaFilter === null ? groups : groups.filter((g) => g.area.id === areaFilter);
  return visible.some((g) => g.contracted.length > 0 || g.candidates.length > 0);
}

// 읽기: 업체에 묶인 지출 1건(표준 케이스 — 업체=지출 1:1). "비용에서 보기" 연동용.
export function findLinkedExpense(snapshot: CoupleSnapshot, vendorId: string): Expense | null {
  return snapshot.expenses.find((e) => e.vendor_id === vendorId) ?? null;
}

// 쓰기: lib/rpc 위임(ADR-0003 — supabase.rpc는 lib/rpc에만). shareCode는 호출 훅이 주입.
export type CreateVendorInput = {
  areaId: string;
  name: string;
  status?: VendorStatus; // 기본 CANDIDATE(업체 화면 "후보 추가"). 비용 화면 인라인 생성은 별도 경로(rpc.createVendor)
  role?: VendorRole | null;
  location?: string | null;
  contractDate?: string | null;
  quotedPrice?: number | null;
  memo?: string | null;
};
export type UpdateVendorInput = {
  id: string;
  name: string;
  status: VendorStatus;
  role?: VendorRole | null;
  location?: string | null;
  contractDate?: string | null;
  quotedPrice?: number | null;
  memo?: string | null;
};

export function createVendor(shareCode: string, input: CreateVendorInput) {
  return rpc.createVendorFull(shareCode, input);
}
export function updateVendor(shareCode: string, input: UpdateVendorInput) {
  return rpc.updateVendor(shareCode, input);
}
export function deleteVendor(shareCode: string, id: string) {
  return rpc.deleteVendor(shareCode, id);
}

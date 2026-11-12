import type { Area, Vendor } from '@/types/db';

// types/db.ts(행 타입)를 넘어서는 뷰·파생 타입만 둔다.

// 영역별 업체 묶음 — 계약 확정(여러 개 가능, 스드메=스튜디오/드레스/메이크업)과 후보를 분리.
export type AreaVendorGroup = {
  area: Area;
  contracted: Vendor[];
  candidates: Vendor[];
};

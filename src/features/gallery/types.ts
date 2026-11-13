import type { Area, Photo } from '@/types/db';

// 영역별 사진 묶음(업체의 AreaVendorGroup과 동일 패턴 — 사진 없는 영역도 빈 배열로 포함).
export type AreaPhotoGroup = {
  area: Area;
  photos: Photo[];
};

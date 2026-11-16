import type { Area, CoupleSnapshot, Photo } from '@/types/db';
import type { AreaPhotoGroup } from './types';
import * as rpc from '@/lib/rpc';

// 코어(순수) — RN/expo UI를 import하지 않는다. 사진만 다룬다(영상은 범위 밖 — 설계 스펙 결정 1).
export const STORAGE_WARNING_BYTES = 800 * 1024 * 1024; // 800MB(Storage 무료 1GB의 80% — ADR-0002)

// 읽기: 스냅샷에서 사진 슬라이스(생성 순 안정 — created_at 그대로, 원본 불변).
export function selectPhotos(snapshot: CoupleSnapshot): Photo[] {
  return [...snapshot.photos];
}

// 읽기: area.sort_order 순으로 영역별 분리. 사진 없는 영역도 빈 그룹으로 포함(업체와 동일 패턴).
export function selectPhotosByArea(snapshot: CoupleSnapshot, areas: Area[]): AreaPhotoGroup[] {
  return [...areas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => ({
      area,
      photos: snapshot.photos.filter((p) => p.area_id === area.id),
    }));
}

export function totalSizeBytes(snapshot: CoupleSnapshot): number {
  return snapshot.photos.reduce((sum, p) => sum + p.size_bytes, 0);
}

export function isNearStorageLimit(totalBytes: number): boolean {
  return totalBytes >= STORAGE_WARNING_BYTES;
}

// 읽기: areaFilter 적용 후에도 보여줄 사진이 하나라도 있는지. 업체 슬라이스에서 실측으로 발견된
// 함정(전체 기준으로만 빈 상태를 판단하면, 필터링 후 0건일 때 안내 문구도 없이 완전히 빈 화면이
// 된다 — docs/02-architecture.md 업체 서브섹션)을 처음부터 피한다.
export function hasVisiblePhotos(groups: AreaPhotoGroup[], areaFilter: string | null): boolean {
  const visible = areaFilter === null ? groups : groups.filter((g) => g.area.id === areaFilter);
  return visible.some((g) => g.photos.length > 0);
}

// 저장/공유 helper(순수) — transfer.ts(RN 글루)가 가져다 쓴다. storage_path는
// `{couple.id}/{uuid}.{ext}` 형태.

// 캐시에 내려받을 로컬 파일명 = storage_path의 마지막 세그먼트(basename). 슬래시가 없으면
// 경로 전체가 곧 파일명이다.
export function photoFileName(storagePath: string): string {
  const seg = storagePath.split('/').pop() ?? '';
  return seg || storagePath;
}

// 확장자 → 공유 시트에 넘길 MIME 타입. 미지의/빈 확장자는 image/jpeg로 폴백(대개 JPEG이고,
// 공유 시트는 틀린 MIME에도 관대하다).
export function mimeTypeFromPath(storagePath: string): string {
  const name = photoFileName(storagePath);
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'heic': return 'image/heic';
    case 'heif': return 'image/heif';
    case 'jpg':
    case 'jpeg':
    default: return 'image/jpeg';
  }
}

// 저장/공유 가능한 사진만 추림: Storage에 실파일이 있고(storage_path != null) 영상이 아닌 것
// (영상은 범위 밖 — 설계 스펙 결정 1). 선택 순서·개수는 보존한다.
export function shareablePhotos(photos: Photo[]): Photo[] {
  return photos.filter((p) => !!p.storage_path && !p.is_video);
}

// 쓰기: lib/rpc 위임(ADR-0003 — supabase.rpc는 lib/rpc에만). shareCode는 호출 훅이 주입.
// storagePath는 features/gallery/upload.ts가 Storage에 직접 업로드한 뒤 넘겨준다(ADR-0007).
export type CreatePhotoInput = {
  areaId: string;
  storagePath: string;
  sizeBytes: number;
  caption?: string | null;
  takenAt?: string | null;
};

export function createPhoto(shareCode: string, input: CreatePhotoInput) {
  return rpc.createPhoto(shareCode, input);
}
export function deletePhoto(shareCode: string, id: string) {
  return rpc.deletePhoto(shareCode, id);
}

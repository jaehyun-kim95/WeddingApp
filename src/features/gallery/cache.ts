import type { CoupleSnapshot, Photo } from '@/types/db';

// 스냅샷 캐시 낙관적 패치(순수·불변). 삭제만 낙관적으로 처리한다 — 업로드는 Storage 왕복 지연이
// 있어 로컬 미리보기를 임시로 끼워 넣는 비용이 이득보다 크다고 판단해 생략(설계 스펙 결정 — 업로드
// 중엔 로딩 상태만 보여준다).

function withPhotos(
  s: CoupleSnapshot,
  photos: Photo[],
): CoupleSnapshot {
  return { ...s, photos };
}

export function applyCreate(
  s: CoupleSnapshot,
  photo: Photo,
): CoupleSnapshot {
  return withPhotos(s, [...s.photos, photo]);
}

export function applyDelete(
  s: CoupleSnapshot,
  id: string,
): CoupleSnapshot {
  return withPhotos(s, s.photos.filter((p) => p.id !== id));
}

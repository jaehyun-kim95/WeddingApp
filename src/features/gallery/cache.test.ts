import type { CoupleSnapshot, Photo } from '@/types/db';
import { applyCreate, applyDelete } from './cache';

const photo = (id: string, extra: Partial<Photo> = {}): Photo => ({
  id,
  created_at: '',
  couple_id: 'c1',
  area_id: 'a1',
  storage_path: `c1/${id}.jpg`,
  external_url: null,
  is_video: false,
  caption: null,
  taken_at: null,
  size_bytes: 0,
  ...extra,
});

const snap = (photos: Photo[]): CoupleSnapshot =>
  ({ photos } as CoupleSnapshot);

describe('applyCreate', () => {
  test('맨 뒤에 추가, 나머지 보존', () => {
    const s0 = snap([photo('a')]);
    const out = applyCreate(s0, photo('b'));
    expect(out.photos.map((p) => p.id)).toEqual(['a', 'b']);
    expect(s0.photos).toHaveLength(1); // 원본 불변
  });
});

describe('applyDelete', () => {
  test('해당 id 제거, 나머지 보존', () => {
    const out = applyDelete(snap([photo('a'), photo('b')]), 'a');
    expect(out.photos.map((p) => p.id)).toEqual(['b']);
  });

  test('병리: 없는 id는 개수 불변', () => {
    expect(applyDelete(snap([photo('a')]), 'zzz').photos).toHaveLength(1);
  });
});

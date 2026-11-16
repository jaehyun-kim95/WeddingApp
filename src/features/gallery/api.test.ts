import type { Area, CoupleSnapshot, Photo } from '@/types/db';
import {
  hasVisiblePhotos, isNearStorageLimit, mimeTypeFromPath, photoFileName, selectPhotos,
  selectPhotosByArea, shareablePhotos, totalSizeBytes,
} from './api';

const area = (id: string, order: number, name: string, code: Area['code'] = 'HALL'): Area => ({
  id, created_at: '', code, name_ko: name, sort_order: order,
});
const photo = (id: string, areaId: string | null, extra: Partial<Photo> = {}): Photo => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, storage_path: `c1/${id}.jpg`,
  external_url: null, is_video: false, caption: null, taken_at: null, size_bytes: 0,
  ...extra,
});
const snap = (photos: Photo[]): CoupleSnapshot => ({ photos } as CoupleSnapshot);

describe('selectPhotos', () => {
  test('스냅샷의 photos를 그대로(새 배열로) 반환, 원본 불변', () => {
    const s = snap([photo('a', 'a1')]);
    const out = selectPhotos(s);
    expect(out).toEqual(s.photos);
    expect(out).not.toBe(s.photos);
  });
});

describe('selectPhotosByArea', () => {
  test('area sort_order 순, 영역별로 분리', () => {
    const areas = [area('a2', 2, '스드메', 'SDM'), area('a1', 1, '웨딩홀', 'HALL')];
    const photos = [photo('p1', 'a1'), photo('p2', 'a2'), photo('p3', 'a1')];
    const out = selectPhotosByArea(snap(photos), areas);
    expect(out.map((g) => g.area.id)).toEqual(['a1', 'a2']);
    expect(out[0].photos.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(out[1].photos.map((p) => p.id)).toEqual(['p2']);
  });

  test('경계: 사진 없는 영역도 빈 배열로 포함', () => {
    const areas = [area('a1', 1, '신혼집', 'HOME')];
    const out = selectPhotosByArea(snap([]), areas);
    expect(out).toEqual([{ area: areas[0], photos: [] }]);
  });
});

describe('totalSizeBytes', () => {
  test('합산', () => {
    const s = snap([photo('a', 'a1', { size_bytes: 100 }), photo('b', 'a1', { size_bytes: 200 })]);
    expect(totalSizeBytes(s)).toBe(300);
  });
  test('빈 배열은 0', () => {
    expect(totalSizeBytes(snap([]))).toBe(0);
  });
});

describe('isNearStorageLimit', () => {
  test('799MB는 false', () => {
    expect(isNearStorageLimit(799 * 1024 * 1024)).toBe(false);
  });
  test('800MB는 true(경계값 포함)', () => {
    expect(isNearStorageLimit(800 * 1024 * 1024)).toBe(true);
  });
});

describe('hasVisiblePhotos', () => {
  const areas = [area('a1', 1, '스드메', 'SDM'), area('a2', 2, '웨딩홀', 'HALL')];
  test('전체 필터에서는 어느 영역에든 사진이 있으면 true', () => {
    const groups = selectPhotosByArea(snap([photo('p1', 'a1')]), areas);
    expect(hasVisiblePhotos(groups, null)).toBe(true);
  });
  test('사진이 하나도 없으면 전체 필터에서 false', () => {
    expect(hasVisiblePhotos(selectPhotosByArea(snap([]), areas), null)).toBe(false);
  });
  test('다른 영역엔 사진이 있어도, 선택한 영역이 비어 있으면 false', () => {
    const groups = selectPhotosByArea(snap([photo('p1', 'a1')]), areas);
    expect(hasVisiblePhotos(groups, 'a2')).toBe(false);
  });
  test('선택한 영역에 사진이 있으면 true', () => {
    const groups = selectPhotosByArea(snap([photo('p1', 'a1')]), areas);
    expect(hasVisiblePhotos(groups, 'a1')).toBe(true);
  });
});

describe('photoFileName', () => {
  test('정상 경로: 마지막 세그먼트', () => {
    expect(photoFileName('c1/abc-123.jpg')).toBe('abc-123.jpg');
  });
  test('슬래시 여러 개: 맨 뒤 세그먼트만', () => {
    expect(photoFileName('c1/sub/deep/x.png')).toBe('x.png');
  });
  test('경계: 슬래시 없으면 경로 전체가 파일명', () => {
    expect(photoFileName('solo.jpg')).toBe('solo.jpg');
  });
  test('병리: 빈 문자열', () => {
    expect(photoFileName('')).toBe('');
  });
  test('병리: 끝이 슬래시면 빈 세그먼트 대신 원본 반환', () => {
    expect(photoFileName('c1/')).toBe('c1/');
  });
});

describe('mimeTypeFromPath', () => {
  test('jpg/jpeg → image/jpeg', () => {
    expect(mimeTypeFromPath('c1/a.jpg')).toBe('image/jpeg');
    expect(mimeTypeFromPath('c1/a.jpeg')).toBe('image/jpeg');
  });
  test('png → image/png', () => {
    expect(mimeTypeFromPath('c1/a.png')).toBe('image/png');
  });
  test('heic/heif/webp/gif 각각 매핑', () => {
    expect(mimeTypeFromPath('c1/a.heic')).toBe('image/heic');
    expect(mimeTypeFromPath('c1/a.heif')).toBe('image/heif');
    expect(mimeTypeFromPath('c1/a.webp')).toBe('image/webp');
    expect(mimeTypeFromPath('c1/a.gif')).toBe('image/gif');
  });
  test('대문자 확장자도 소문자로 정규화', () => {
    expect(mimeTypeFromPath('c1/a.PNG')).toBe('image/png');
  });
  test('병리: 미지의 확장자 → image/jpeg 폴백', () => {
    expect(mimeTypeFromPath('c1/a.xyz')).toBe('image/jpeg');
  });
  test('병리: 확장자 없음 → image/jpeg 폴백', () => {
    expect(mimeTypeFromPath('c1/noext')).toBe('image/jpeg');
  });
});

describe('shareablePhotos', () => {
  test('storage_path 없는/영상인 사진 제거', () => {
    const photos = [
      photo('p1', 'a1'),
      photo('p2', 'a1', { storage_path: null }),
      photo('p3', 'a1', { is_video: true }),
    ];
    expect(shareablePhotos(photos).map((p) => p.id)).toEqual(['p1']);
  });
  test('오탐 방지: 전부 유효하면 개수·순서 그대로 보존', () => {
    const photos = [photo('p1', 'a1'), photo('p2', 'a2'), photo('p3', 'a1')];
    expect(shareablePhotos(photos).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });
  test('병리: 빈 배열', () => {
    expect(shareablePhotos([])).toEqual([]);
  });
  test('병리: 전부 제외 대상이면 빈 배열', () => {
    const photos = [
      photo('p1', 'a1', { storage_path: null }),
      photo('p2', 'a1', { is_video: true }),
    ];
    expect(shareablePhotos(photos)).toEqual([]);
  });
});

# 갤러리(gallery) 슬라이스 구현 계획 (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 갤러리 화면(`app/gallery.tsx`)을 실데이터 CRUD로 동작시킨다 — 영역 필터 + 영역별 3열
썸네일 그리드 + 기기 갤러리에서 사진 선택 업로드 + 전체화면 보기/삭제 + 용량 통계·80% 경고 배너.

**Architecture:** 체크리스트·업체·하객과 동일한 패턴(코어 `api.ts`+낙관적 캐시 `cache.ts`+
`hooks.ts`+`components/`). 다른 점은 Storage 바이너리 — ADR-0007에 따라 `photo` 행만 기존 RPC
게이트웨이(ADR-0003)로 쓰고, Storage 오브젝트 자체는 `couple.id` 경로 접두사 RLS 아래 클라이언트가
Supabase Storage SDK로 직접 업로드/삭제한다.

**Tech Stack:** Expo SDK 58 / React Native 0.88 / Expo Router / TanStack Query v5 / Supabase(Postgres
RPC + Storage) / `expo-image-picker` / `base64-arraybuffer` / jest-expo.

**설계 스펙:** `docs/superpowers/specs/2026-11-13-phase2-gallery-slice-design.md`
**ADR:** `docs/decisions/0007-gallery-storage-access.md`

---

## 파일 구조 (생성/수정)

| 파일 | 책임 | 작업 |
|---|---|---|
| `supabase/migrations/0008_gallery.sql` | `size_bytes` 컬럼 + Storage 버킷/RLS + `create_photo`/`delete_photo` | 생성 |
| `src/types/db.ts` | `Photo` 타입에 `size_bytes` 추가 | 수정 |
| `package.json` | `expo-image-picker`·`base64-arraybuffer` 의존성 추가 | 수정 |
| `src/lib/bytes.ts` | 바이트→MB/GB 표시 변환(순수) | 생성 |
| `src/lib/bytes.test.ts` | 단위 테스트 | 생성 |
| `src/lib/rpc.ts` | RPC 래퍼 2종 추가(`createPhoto`·`deletePhoto`) | 수정 |
| `src/features/gallery/types.ts` | `AreaPhotoGroup` 뷰 타입 | 생성 |
| `src/features/gallery/api.ts` | 셀렉터 + 용량 계산 + 쓰기 위임 | 생성 |
| `src/features/gallery/api.test.ts` | 셀렉터 단위 테스트 | 생성 |
| `src/features/gallery/cache.ts` | 스냅샷 낙관적 패치 순수 리듀서 | 생성 |
| `src/features/gallery/cache.test.ts` | 리듀서 단위 테스트 | 생성 |
| `src/features/gallery/upload.ts` | Storage 업로드/삭제 RN 글루(ADR-0007) | 생성 |
| `src/features/gallery/hooks.ts` | 읽기·쓰기 훅 | 생성 |
| `src/features/gallery/components/storage-usage-banner.tsx` | 상단 통계+80% 경고 | 생성 |
| `src/features/gallery/components/photo-grid.tsx` | 3열 썸네일 그리드 | 생성 |
| `src/features/gallery/components/photo-viewer-modal.tsx` | 전체화면 보기+삭제 | 생성 |
| `src/features/gallery/components/photo-upload-sheet.tsx` | 업로드 전 영역 선택 모달 | 생성 |
| `src/features/gallery/index.ts` | 배럴 | 생성 |
| `src/app/gallery.tsx` | 화면 조립(`PlaceholderScreen` 교체) | 수정 |
| `docs/04-dev-plan.md`·`.claude/CLAUDE.md`·`.claude/HANDOFF.md` | 체크박스/현재 상태 갱신 | 수정 |

---

## Task 1: 스키마 — `0008_gallery.sql` + `Photo` 타입

**Files:**
- Create: `supabase/migrations/0008_gallery.sql`
- Modify: `src/types/db.ts`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/0008_gallery.sql`:
```sql
-- Phase 2 갤러리(gallery) 슬라이스 — 사진 쓰기 RPC + Storage 버킷/RLS(ADR-0007) + 용량 컬럼.
-- photo 테이블·get_couple_snapshot의 'photos' 슬라이스·trg_bc_photo 브로드캐스트는 0001에 이미
-- 있다 → 여기선 size_bytes 컬럼 추가 + Storage 설정 + 쓰기 RPC만 추가한다.
-- forward-only: 0001~0007이 적용된 프로젝트의 SQL Editor에 전체를 1회 실행.

-- ===========================================================================
-- 1. size_bytes 컬럼 — 용량 통계·80% 경고 계산용(기존 행 없음, 하위호환 이슈 없음)
-- ===========================================================================
alter table photo add column if not exists size_bytes bigint not null default 0;

-- ===========================================================================
-- 2. Storage 버킷 — public(서명 URL 없이 공개 URL로 바로 표시, ADR-0007)
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- ===========================================================================
-- 3. Storage RLS — 경로 첫 세그먼트({couple.id}/...)가 실제 존재하는 couple.id인가만 검사
--    (ADR-0007 — 이 앱은 Auth가 없어 서명 URL을 발급할 서버가 없다. share_code는 여기서 검사하지
--    않는다 — couple.id 자체가 share_code로 조회해야만 얻어지므로 동일 신뢰 수준이다)
-- ===========================================================================
create policy photos_insert on storage.objects for insert to anon
  with check (
    bucket_id = 'photos'
    and exists (select 1 from couple c where c.id::text = (storage.foldername(name))[1])
  );

create policy photos_select on storage.objects for select to anon
  using (bucket_id = 'photos');

create policy photos_delete on storage.objects for delete to anon
  using (
    bucket_id = 'photos'
    and exists (select 1 from couple c where c.id::text = (storage.foldername(name))[1])
  );

-- ===========================================================================
-- 4. create_photo / delete_photo — photo 행 쓰기(ADR-0003 RPC 게이트웨이, Storage 오브젝트
--    자체는 클라이언트가 직접 접근 — ADR-0007)
-- ===========================================================================
create or replace function public.create_photo(
  p_share_code text, p_area_id uuid, p_storage_path text, p_size_bytes bigint,
  p_caption text default null, p_taken_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row photo%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into photo (couple_id, area_id, storage_path, size_bytes, is_video, caption, taken_at)
    values (v_couple, p_area_id, p_storage_path, p_size_bytes, false, p_caption, p_taken_at)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_photo(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from photo where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'photo not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

-- ===========================================================================
-- 5. 실행 권한
-- ===========================================================================
grant execute on function public.create_photo(text,uuid,text,bigint,text,timestamptz) to anon;
grant execute on function public.delete_photo(text,uuid) to anon;
```

- [ ] **Step 2: `Photo` 타입에 `size_bytes` 추가**

`src/types/db.ts`의 `Photo` 타입(현재 159번째 줄 근처)을 교체:
```ts
export type Photo = {
  id: string;
  created_at: string;
  couple_id: string;
  area_id: string | null;
  storage_path: string | null;
  external_url: string | null;
  is_video: boolean;
  caption: string | null;
  taken_at: string | null;
  size_bytes: number;
};
```

- [ ] **Step 3: tsc 확인(기존 테스트 fixture가 `size_bytes` 없이 Photo를 만드는 곳이 있으면
  에러가 날 수 있다 — 지금은 없는지만 확인)**

Run: `npx tsc --noEmit`
Expected: 0 에러(이 타입을 아직 아무도 안 쓰므로 영향 없음)

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0008_gallery.sql src/types/db.ts
git commit -m "feat(db): 갤러리 사진 쓰기 RPC + Storage 버킷/RLS + size_bytes 컬럼"
```

**⚠️ 사용자 작업 필요**: 이 파일은 코드 커밋만으로 반영되지 않는다. 이 저장소는 Supabase CLI
링크가 없으므로(`supabase/config.toml` 부재), **사용자가 Supabase 대시보드 SQL Editor에 이 파일
전체를 붙여넣어 직접 실행**해야 한다(하객 0006·업체 0007 선례). Task 12 실측은 이 마이그레이션이
라이브 적용된 뒤에야 가능하다.

---

## Task 2: 패키지 설치

**Files:**
- Modify: `package.json`, `package-lock.json`(또는 해당 lockfile)

- [ ] **Step 1: 설치**

```bash
npx expo install expo-image-picker
npm install base64-arraybuffer
```

- [ ] **Step 2: 설치 확인**

Run: `grep -n "expo-image-picker\|base64-arraybuffer" package.json`
Expected: 두 패키지 모두 `dependencies`에 나타남.

- [ ] **Step 3: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: 갤러리용 expo-image-picker·base64-arraybuffer 추가"
```

---

## Task 3: 바이트 표시 유틸 — `src/lib/bytes.ts` (TDD)

**Files:**
- Create: `src/lib/bytes.ts`
- Create: `src/lib/bytes.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/bytes.test.ts`:
```ts
import { formatBytes } from './bytes';

describe('formatBytes', () => {
  test('0 이하는 "0MB"', () => {
    expect(formatBytes(0)).toBe('0MB');
    expect(formatBytes(-5)).toBe('0MB');
  });
  test('1000MB 미만은 MB, 소수 한 자리', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0MB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4MB');
  });
  test('1000MB 이상은 GB, 소수 한 자리', () => {
    expect(formatBytes(2.4 * 1024 * 1024 * 1024)).toBe('2.4GB');
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm test -- src/lib/bytes.test.ts`
Expected: FAIL(`Cannot find module './bytes'`)

- [ ] **Step 3: 구현**

Create `src/lib/bytes.ts`:
```ts
// 바이트 표시 단위 변환. 저장은 바이트(photo.size_bytes, DB), 표시는 MB/GB(갤러리 용량 통계·
// 80% 경고 전용 — 금액이 아니므로 money.ts와 분리한다).
const MB = 1024 * 1024;
const GB = MB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0MB';
  if (bytes < 1000 * MB) return `${(bytes / MB).toFixed(1)}MB`;
  return `${(bytes / GB).toFixed(1)}GB`;
}
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

Run: `npm test -- src/lib/bytes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/bytes.ts src/lib/bytes.test.ts
git commit -m "feat(lib): 바이트 표시 변환 유틸(bytes.ts)"
```

---

## Task 4: RPC 래퍼 — `src/lib/rpc.ts`

**Files:**
- Modify: `src/lib/rpc.ts`

- [ ] **Step 1: 타입 import 추가**

파일 상단 첫 번째 `import type {...} from '@/types/db';` 블록에 `Photo`를 추가(알파벳 순,
`Payment` 다음):
```ts
import type {
  AreaBudget, AttendStatus, ChecklistItem, CoupleSnapshot, Expense, ExpenseOption, Guest, Payment,
  Photo, ScheduleEvent, Vendor, WeddingDateStatus,
} from '@/types/db';
```
그 아래, 기존 `import type { CreateVendorInput, UpdateVendorInput } from '@/features/vendors/api';`
줄 다음에 추가:
```ts
import type { CreatePhotoInput } from '@/features/gallery/api';
```

- [ ] **Step 2: 래퍼 2종 추가**

파일 맨 끝에 추가:
```ts
export async function createPhoto(shareCode: string, input: CreatePhotoInput): Promise<Photo> {
  const { data, error } = await supabase.rpc('create_photo', {
    p_share_code: shareCode, p_area_id: input.areaId, p_storage_path: input.storagePath,
    p_size_bytes: input.sizeBytes, p_caption: input.caption ?? null, p_taken_at: input.takenAt ?? null,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Photo;
}

export async function deletePhoto(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_photo', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}
```

- [ ] **Step 3: tsc 확인(아직 features/gallery/api가 없어 에러 나는 게 정상)**

Run: `npx tsc --noEmit`
Expected: `Cannot find module '@/features/gallery/api'` 에러만 나면 정상(Task 5에서 해소).

- [ ] **Step 4: 커밋은 Task 5와 함께**(features/gallery/api.ts 없이는 타입체크가 깨져 있어 중간
  상태를 단독 커밋하지 않는다)

---

## Task 5: 도메인 코어 — `src/features/gallery/api.ts` (TDD)

**Files:**
- Create: `src/features/gallery/types.ts`
- Create: `src/features/gallery/api.ts`
- Create: `src/features/gallery/api.test.ts`

- [ ] **Step 1: 뷰 타입**

Create `src/features/gallery/types.ts`:
```ts
import type { Area, Photo } from '@/types/db';

// 영역별 사진 묶음(업체의 AreaVendorGroup과 동일 패턴 — 사진 없는 영역도 빈 배열로 포함).
export type AreaPhotoGroup = {
  area: Area;
  photos: Photo[];
};
```

- [ ] **Step 2: 실패하는 셀렉터 테스트 작성**

Create `src/features/gallery/api.test.ts`:
```ts
import type { Area, CoupleSnapshot, Photo } from '@/types/db';
import {
  hasVisiblePhotos, isNearStorageLimit, selectPhotos, selectPhotosByArea, totalSizeBytes,
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
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `npm test -- src/features/gallery/api.test.ts`
Expected: FAIL(`Cannot find module './api'`)

- [ ] **Step 4: 구현**

Create `src/features/gallery/api.ts`:
```ts
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
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `npm test -- src/features/gallery/api.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: 전체 tsc 확인(Task 4에서 남겨둔 에러가 해소됐는지)**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 7: 커밋(Task 4 변경분 포함)**

```bash
git add src/lib/rpc.ts src/features/gallery/types.ts src/features/gallery/api.ts src/features/gallery/api.test.ts
git commit -m "feat(gallery): RPC 래퍼 + 도메인 셀렉터/쓰기 위임(api.ts)"
```

---

## Task 6: 낙관적 캐시 — `src/features/gallery/cache.ts` (TDD)

**Files:**
- Create: `src/features/gallery/cache.ts`
- Create: `src/features/gallery/cache.test.ts`

- [ ] **Step 1: 실패하는 리듀서 테스트 작성**

Create `src/features/gallery/cache.test.ts`:
```ts
import type { CoupleSnapshot, Photo } from '@/types/db';
import { applyCreate, applyDelete } from './cache';

const photo = (id: string, extra: Partial<Photo> = {}): Photo => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', storage_path: `c1/${id}.jpg`,
  external_url: null, is_video: false, caption: null, taken_at: null, size_bytes: 0,
  ...extra,
});
const snap = (photos: Photo[]): CoupleSnapshot => ({ photos } as CoupleSnapshot);

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
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm test -- src/features/gallery/cache.test.ts`
Expected: FAIL(`Cannot find module './cache'`)

- [ ] **Step 3: 구현**

Create `src/features/gallery/cache.ts`:
```ts
import type { CoupleSnapshot, Photo } from '@/types/db';

// 스냅샷 캐시 낙관적 패치(순수·불변). 삭제만 낙관적으로 처리한다 — 업로드는 Storage 왕복 지연이
// 있어 로컬 미리보기를 임시로 끼워 넣는 비용이 이득보다 크다고 판단해 생략(설계 스펙 결정 — 업로드
// 중엔 로딩 상태만 보여준다).

function withPhotos(s: CoupleSnapshot, photos: Photo[]): CoupleSnapshot {
  return { ...s, photos };
}

export function applyCreate(s: CoupleSnapshot, photo: Photo): CoupleSnapshot {
  return withPhotos(s, [...s.photos, photo]);
}

export function applyDelete(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return withPhotos(s, s.photos.filter((p) => p.id !== id));
}
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

Run: `npm test -- src/features/gallery/cache.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/features/gallery/cache.ts src/features/gallery/cache.test.ts
git commit -m "feat(gallery): 낙관적 캐시 리듀서(cache.ts)"
```

---

## Task 7: Storage 업로드 글루 — `src/features/gallery/upload.ts`

**Files:**
- Create: `src/features/gallery/upload.ts`

RN 전용 I/O 레이어라 하객 `excel-io.ts`와 동일하게 단위테스트 대상에서 제외한다(통합 성격 —
실기기/웹에서 Task 12로 실측).

- [ ] **Step 1: 구현**

Create `src/features/gallery/upload.ts`:
```ts
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

// RN 글루 레이어(ADR-0007) — expo-image-picker/base64-arraybuffer/supabase Storage SDK는 여기서만
// import한다. 코어(api.ts)는 이 파일을 모른다. 카메라 촬영은 범위 밖(설계 스펙 결정 2) — 기기
// 갤러리 선택만 지원한다.
export type PickedPhoto = {
  previewUri: string; // 로컬 미리보기(업로드 시트에 그대로 보여준다)
  buffer: ArrayBuffer;
  contentType: string;
  ext: string;
  sizeBytes: number;
};

// 기기 갤러리에서 사진 1장 선택. 권한 거부·취소 시 null.
export async function pickImage(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  const buffer = decode(asset.base64 as string);
  const contentType = asset.mimeType ?? 'image/jpeg';
  const ext = contentType.split('/')[1] ?? 'jpg';
  return { previewUri: asset.uri, buffer, contentType, ext, sizeBytes: buffer.byteLength };
}

// Storage 직접 업로드(ADR-0007 — couple.id 경로 접두사 RLS, RPC 게이트웨이의 의도된 예외).
export async function uploadPhotoFile(coupleId: string, picked: PickedPhoto): Promise<string> {
  const path = `${coupleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${picked.ext}`;
  const { error } = await supabase.storage.from('photos').upload(path, picked.buffer, {
    contentType: picked.contentType,
  });
  if (error) throw error;
  return path;
}

// Storage 직접 삭제(ADR-0007). delete_photo RPC보다 반드시 먼저 호출한다 — 순서가 바뀌면(행 먼저
// 삭제) 오브젝트만 고아로 남고 가리킬 행이 없어 재시도가 어려워진다. 오브젝트를 먼저 지우면 행
// 삭제가 실패해도 "안 보이는 사진이 Storage에 미세하게 남는" 더 안전한 상태로 재시도할 수 있다.
export async function deletePhotoFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from('photos').remove([storagePath]);
  if (error) throw error;
}

// public 버킷이므로 서명 URL 없이 공개 URL로 바로 표시한다.
export function photoPublicUrl(storagePath: string): string {
  return supabase.storage.from('photos').getPublicUrl(storagePath).data.publicUrl;
}
```

- [ ] **Step 2: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러(`base64-arraybuffer`에 타입 선언이 없다는 에러가 나면, 같은 디렉터리에
`src/types/base64-arraybuffer.d.ts`를 만들어 `declare module 'base64-arraybuffer';`로 임시
선언한다 — 패키지 자체에 `.d.ts`가 있으면 이 스텝은 생략).

- [ ] **Step 3: 커밋**

```bash
git add src/features/gallery/upload.ts
git commit -m "feat(gallery): Storage 업로드/삭제 RN 글루(upload.ts, ADR-0007)"
```

---

## Task 8: Query/Mutation 훅 — `src/features/gallery/hooks.ts`

**Files:**
- Create: `src/features/gallery/hooks.ts`

- [ ] **Step 1: 구현**

Create `src/features/gallery/hooks.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { Area, CoupleSnapshot } from '@/types/db';
import * as api from './api';
import * as cache from './cache';
import { deletePhotoFile, type PickedPhoto, uploadPhotoFile } from './upload';

export function usePhotosByArea(areas: Area[]) {
  return useCoupleSnapshot((s) => api.selectPhotosByArea(s, areas));
}

export function useStorageUsage() {
  return useCoupleSnapshot((s) => {
    const totalBytes = api.totalSizeBytes(s);
    return { totalBytes, nearLimit: api.isNearStorageLimit(totalBytes), count: s.photos.length };
  });
}

// 업로드는 낙관적 캐시를 쓰지 않는다(cache.ts 주석 참고) — Storage 왕복이 끝난 뒤 성공 시
// invalidate로 실제 행을 받아온다. 실패하면 Alert로 사유를 보여준다(다른 4개 feature와 동일 교훈).
export function useUploadPhoto() {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: async ({ areaId, picked }: { areaId: string; picked: PickedPhoto }) => {
      const snapshot = qc.getQueryData<CoupleSnapshot>(key);
      if (!snapshot) throw new Error('커플 정보를 불러오지 못했습니다.');
      const storagePath = await uploadPhotoFile(snapshot.couple.id, picked);
      return api.createPhoto(shareCode as string, { areaId, storagePath, sizeBytes: picked.sizeBytes });
    },
    onError: (e) => {
      Alert.alert('업로드하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeletePhoto() {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await deletePhotoFile(storagePath);
      return api.deletePhoto(shareCode as string, id);
    },
    onMutate: async ({ id }: { id: string; storagePath: string }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CoupleSnapshot>(key);
      if (prev) qc.setQueryData(key, cache.applyDelete(prev, id));
      return { prev };
    },
    onError: (e, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      Alert.alert('삭제하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
```

- [ ] **Step 2: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 3: 커밋**

```bash
git add src/features/gallery/hooks.ts
git commit -m "feat(gallery): Query/Mutation 훅(hooks.ts)"
```

---

## Task 9: UI 컴포넌트 4종

**Files:**
- Create: `src/features/gallery/components/storage-usage-banner.tsx`
- Create: `src/features/gallery/components/photo-grid.tsx`
- Create: `src/features/gallery/components/photo-viewer-modal.tsx`
- Create: `src/features/gallery/components/photo-upload-sheet.tsx`

- [ ] **Step 1: 상단 통계+경고 배너**

Create `src/features/gallery/components/storage-usage-banner.tsx`:
```tsx
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { formatBytes } from '@/lib/bytes';

// 목업 `.gallery-top`에서 "영상" 칸만 뺀 2칸(전체 장수·원본 보관 용량, 설계 스펙 결정 1) +
// 80% 이상이면 경고 배너(설계 스펙 결정 3).
export function StorageUsageBanner({
  count, totalBytes, nearLimit,
}: { count: number; totalBytes: number; nearLimit: boolean }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="inkMuted">전체</Text>
          <Text variant="stat" tabularNums>{count}장</Text>
        </View>
        <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: spacing.lg }}>
          <Text variant="caption" color="inkMuted">원본 보관</Text>
          <Text variant="stat" tabularNums>{formatBytes(totalBytes)}</Text>
        </View>
      </View>
      {nearLimit ? (
        <View
          style={{
            marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md,
            backgroundColor: colors.blushSoft,
          }}
        >
          <Text variant="bodySm" color="blushInk">
            무료 저장 용량(1GB)의 80%를 넘었어요. 사진이 더 쌓이면 보관 방법을 다시 정해야 해요.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: 3열 썸네일 그리드**

Create `src/features/gallery/components/photo-grid.tsx`:
```tsx
import { Image, Pressable, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { Photo } from '@/types/db';
import { photoPublicUrl } from '../upload';

// 목업 `.photo-grid`(3열 정사각). 이미지 격자 = 카드그리드 금지의 예외(DESIGN.md).
export function PhotoGrid({
  photos, onPressPhoto,
}: { photos: Photo[]; onPressPhoto: (photo: Photo) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {photos.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onPressPhoto(p)}
          accessibilityRole="button"
          accessibilityLabel="사진 보기"
          style={{
            width: '31.3%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden',
            borderWidth: 1, borderColor: colors.line, backgroundColor: colors.groundDeep,
          }}
        >
          {p.storage_path ? (
            <Image source={{ uri: photoPublicUrl(p.storage_path) }} style={{ width: '100%', height: '100%' }} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 3: 전체화면 보기+삭제 모달**

Create `src/features/gallery/components/photo-viewer-modal.tsx`:
```tsx
import { Image, Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui';
import { layout, spacing } from '@/constants/theme';
import type { Photo } from '@/types/db';
import { photoPublicUrl } from '../upload';

// 원본 보기+삭제만 지원(설계 스펙 결정 5 — 영역 재분류·캡션 편집 없음).
export function PhotoViewerModal({
  photo, onDelete, onClose,
}: { photo: Photo | null; onDelete: (photo: Photo) => void; onClose: () => void }) {
  if (!photo) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000dd', justifyContent: 'center', alignItems: 'center', padding: layout.screenPadding }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
        <View style={{ width: '100%', maxWidth: layout.appMaxWidth, gap: spacing.md }}>
          {photo.storage_path ? (
            <Image
              source={{ uri: photoPublicUrl(photo.storage_path) }}
              style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
              resizeMode="contain"
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="ghost" label="닫기" onPress={onClose} />
            <Button label="삭제" onPress={() => onDelete(photo)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: 업로드 전 영역 선택 모달**

Create `src/features/gallery/components/photo-upload-sheet.tsx`:
```tsx
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, Chip, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area } from '@/types/db';
import type { PickedPhoto } from '../upload';

// 업로드 전 영역 선택(설계 스펙 결정 6 — 업로드 시 1회 선택, 이후 고정). picked가 없으면 아무것도
// 렌더링하지 않는다 — 화면이 pickImage() 호출 후 결과가 있을 때만 이 컴포넌트를 "연다"(key prop을
// 바꿔 매번 영역 선택 상태를 리셋).
export function PhotoUploadSheet({
  picked, areas, defaultAreaId, uploading, onConfirm, onCancel,
}: {
  picked: PickedPhoto | null;
  areas: Area[];
  defaultAreaId: string | null;
  uploading: boolean;
  onConfirm: (areaId: string) => void;
  onCancel: () => void;
}) {
  const [areaId, setAreaId] = useState(defaultAreaId ?? areas[0]?.id ?? '');

  if (!picked) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000066' }} onPress={onCancel} />
      <View style={{ maxHeight: '88%', backgroundColor: colors.ground, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <ScrollView contentContainerStyle={{ padding: layout.screenPadding, gap: spacing.lg }}>
          <Text variant="title">사진 추가</Text>
          <Image
            source={{ uri: picked.previewUri }}
            style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md }}
            resizeMode="cover"
          />
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodySm" color="inkMuted">영역</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {areas.map((a) => (
                <Pressable key={a.id} onPress={() => setAreaId(a.id)}>
                  <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="ghost" label="취소" onPress={onCancel} disabled={uploading} />
            <Button
              label={uploading ? '업로드 중...' : '업로드'}
              onPress={() => onConfirm(areaId)}
              disabled={uploading || !areaId}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 5: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 6: 커밋**

```bash
git add src/features/gallery/components
git commit -m "feat(gallery): 통계 배너·썸네일 그리드·뷰어·업로드 시트 컴포넌트"
```

---

## Task 10: 배럴 — `src/features/gallery/index.ts`

**Files:**
- Create: `src/features/gallery/index.ts`

- [ ] **Step 1: 구현**

Create `src/features/gallery/index.ts`:
```ts
// gallery 도메인 공개 API(배럴).
export { useDeletePhoto, usePhotosByArea, useStorageUsage, useUploadPhoto } from './hooks';
export {
  hasVisiblePhotos, isNearStorageLimit, selectPhotos, selectPhotosByArea, STORAGE_WARNING_BYTES,
  totalSizeBytes,
} from './api';
export type { CreatePhotoInput } from './api';
export type { AreaPhotoGroup } from './types';
export { photoPublicUrl, pickImage, type PickedPhoto } from './upload';
export { PhotoGrid } from './components/photo-grid';
export { PhotoUploadSheet } from './components/photo-upload-sheet';
export { PhotoViewerModal } from './components/photo-viewer-modal';
export { StorageUsageBanner } from './components/storage-usage-banner';
```

- [ ] **Step 2: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 3: 커밋**

```bash
git add src/features/gallery/index.ts
git commit -m "feat(gallery): 배럴(index.ts)"
```

---

## Task 11: 화면 조립 — `src/app/gallery.tsx`

**Files:**
- Modify: `src/app/gallery.tsx`

- [ ] **Step 1: `PlaceholderScreen` 교체**

Replace `src/app/gallery.tsx` 전체:
```tsx
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { AreaFilter } from '@/features/checklist/components/area-filter';
import { useCouple } from '@/features/couple';
import {
  hasVisiblePhotos, PhotoGrid, PhotoUploadSheet, PhotoViewerModal, pickImage, StorageUsageBanner,
  useDeletePhoto, usePhotosByArea, useStorageUsage, useUploadPhoto,
} from '@/features/gallery';
import type { PickedPhoto } from '@/features/gallery';
import { useAreas } from '@/hooks/use-areas';
import type { Photo } from '@/types/db';

// 네이티브 스택 헤더가 이미 "← 갤러리" 제목+뒤로가기를 제공한다(_layout.tsx의 headerShown:true).
// PageHead를 중복으로 쓰지 않는다(업체·하객 화면과 동일 패턴).
export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { data: couple } = useCouple();
  const { data: areas = [] } = useAreas();
  const { data: groups = [] } = usePhotosByArea(areas);
  const { data: usage } = useStorageUsage();

  const upload = useUploadPhoto();
  const remove = useDeletePhoto();

  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [pickedKey, setPickedKey] = useState(0);
  const [viewing, setViewing] = useState<Photo | null>(null);

  const visibleGroups = areaFilter === null ? groups : groups.filter((g) => g.area.id === areaFilter);
  const hasAny = hasVisiblePhotos(groups, areaFilter);

  const openPicker = async () => {
    const result = await pickImage();
    if (result) {
      setPicked(result);
      setPickedKey((k) => k + 1);
    }
  };
  const confirmUpload = (areaId: string) => {
    if (!picked) return;
    upload.mutate({ areaId, picked });
    setPicked(null);
  };
  const confirmDelete = (photo: Photo) => {
    if (photo.storage_path) remove.mutate({ id: photo.id, storagePath: photo.storage_path });
    setViewing(null);
  };

  const sub = couple
    ? `${couple.groom_name} & ${couple.bride_name}${couple.wedding_date ? ` · ${couple.wedding_date}` : ''}`
    : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: 100 + insets.bottom }}>
        {sub ? <Text variant="meta" color="inkMuted">{sub}</Text> : null}

        <View style={{ marginTop: spacing.lg }}>
          <StorageUsageBanner
            count={usage?.count ?? 0}
            totalBytes={usage?.totalBytes ?? 0}
            nearLimit={usage?.nearLimit ?? false}
          />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <AreaFilter areas={areas} selected={areaFilter} onSelect={setAreaFilter} />
        </View>

        {!hasAny ? (
          <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
            <Text variant="body" color="inkMuted">아직 등록된 사진이 없습니다.</Text>
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
              아래 &lsquo;사진 추가&rsquo;로 시작하세요.
            </Text>
          </View>
        ) : (
          visibleGroups.map((g) => {
            if (g.photos.length === 0) return null;
            return (
              <View key={g.area.id} style={{ marginTop: spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text variant="titleSm">{g.area.name_ko}</Text>
                  <Text variant="caption" color="inkMuted">{g.photos.length}장</Text>
                </View>
                <PhotoGrid photos={g.photos} onPressPhoto={setViewing} />
              </View>
            );
          })
        )}
      </ScrollView>

      <Fab label="사진 추가" onPress={openPicker} bottomInset={insets.bottom} />

      <PhotoUploadSheet
        key={pickedKey}
        picked={picked}
        areas={areas}
        defaultAreaId={areaFilter}
        uploading={upload.isPending}
        onConfirm={confirmUpload}
        onCancel={() => setPicked(null)}
      />
      <PhotoViewerModal photo={viewing} onDelete={confirmDelete} onClose={() => setViewing(null)} />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: tsc·lint 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 에러 · 0 lint 경고

- [ ] **Step 3: 커밋**

```bash
git add src/app/gallery.tsx
git commit -m "feat(gallery): 갤러리 화면 실구현 — 영역 필터+그리드+업로드+뷰어"
```

---

## Task 12: 전체 검증 + 문서 갱신

**Files:**
- Modify: `docs/04-dev-plan.md`
- Modify: `.claude/CLAUDE.md`
- Modify: `.claude/HANDOFF.md`

- [ ] **Step 1: 전체 테스트·타입·린트**

Run:
```bash
npx tsc --noEmit
npm test
npm run lint
```
Expected: 전부 0 에러.

- [ ] **Step 2: 라이브 마이그레이션 적용 확인(사용자)**

사용자가 Task 1의 `0008_gallery.sql`을 Supabase SQL Editor에서 실행했는지 확인한다. 아직
안 했다면 **여기서 멈추고 사용자에게 요청** — 이후 실기기/웹 업로드·삭제 실측이 전부 이 단계에
의존한다(Storage 버킷·RLS 정책도 이 마이그레이션에 포함돼 있다).

- [ ] **Step 3: 실기기/웹 업로드 경계 실측**

다음을 순서대로 실행하고 결과를 기록한다:
1. 빈 상태 확인 → "사진 추가" 탭 → 기기 갤러리에서 사진 1장 선택 → 미리보기+영역 선택 시트가
   뜨는지 → 영역 선택 후 "업로드" → 그리드에 썸네일이 나타나는지.
2. 상단 통계(전체 장수·원본 보관 용량)가 업로드 직후 갱신되는지.
3. 썸네일 탭 → 전체화면 보기 모달 → "삭제" → 그리드·통계에서 사라지는지(Storage 오브젝트도
   사라졌는지는 Supabase 대시보드 Storage 탭에서 확인).
4. 영역 필터 전체/개별 전환 시 해당 영역만 보이는지, 사진이 없는 영역 선택 시 안내 문구가 뜨는지
   (업체 슬라이스에서 발견된 버그 재발 여부 확인 — `hasVisiblePhotos`가 처음부터 올바르게 동작하는지).
5. 테스트 데이터로 800MB 이상을 강제 재현해 경고 배너가 뜨는지 확인(Supabase SQL Editor에서
   `update photo set size_bytes = 900*1024*1024 where id = (select id from photo limit 1);`로
   임시 조작 후 확인, **확인 후 원래 값으로 되돌리거나 테스트 행을 삭제**).
6. 웹 프리뷰에서는 `expo-image-picker`가 `<input type=file>`로 대체되므로, 네이티브 권한 요청
   UX(최초 1회 "사진 접근 허용" 다이얼로그)는 **실기기(Expo Go)에서 별도로 확인 필요** — 미검증으로
   남기고 다음 섹션에 기록한다.

- [ ] **Step 4: `docs/04-dev-plan.md` 체크박스 갱신**

`## Phase 2` 아래 "검증 체크리스트 — 갤러리" 섹션을 갱신:
```markdown
**검증 체크리스트 — 갤러리**
- [x] `npx tsc --noEmit` / `jest` / `eslint` 0에러
- [x] 사진 업로드→Storage 저장→썸네일 표시, 영역 분류 동작(실측)
- [ ] 실기기(Expo Go)에서 expo-image-picker 권한 요청 플로우 — 웹 프리뷰로는 확인 불가, 미검증
```

- [ ] **Step 5: `.claude/CLAUDE.md` 「현재 상태」 갱신**

"갤러리" 화면별 핵심 구조 줄을 추가(기존 "갤러리 — 영역 필터+3열 썸네일 그리드..." 문구 교체):
```markdown
- **갤러리** — **실구현 완료**(`app/gallery.tsx`+`features/gallery/`). 사진만(영상 범위 밖)·기기
  갤러리 선택 업로드만(카메라 범위 밖, ADR 결정 2026-11-13). 영역 필터+3열 썸네일 그리드+전체화면
  보기/삭제+상단 통계(전체 장수·원본 보관 용량)+Storage 1GB의 80% 이상 시 경고 배너. Storage는
  `couple.id` 경로 접두사 RLS로 클라이언트가 직접 업로드/삭제(ADR-0007, RPC 게이트웨이의 유일한
  예외) — `photo` 행 자체는 기존처럼 `create_photo`/`delete_photo` RPC.
```
「진행 현황」 표의 Phase 3(개발) 요약 줄도 갱신(Phase 2 세 기능 전부 완료):
```markdown
| 3 — 개발 | Phase 0·Phase 1(홈·일정·체크·비용) 완료. **Phase 2(하객·업체·갤러리) 전부 완료** | 🟡 Realtime 검증 보류, 하객 엑셀 실기기 플로우·갤러리 이미지 피커 권한 플로우 미검증 |
```
"현재 상태" 상단 요약 문단에서 "갤러리·준비영역 모아보기·설정은 화면만 승인, 실구현은 Phase 2~3"
문구를 "준비영역 모아보기·설정은 화면만 승인, 실구현은 Phase 3"으로 교체(갤러리가 빠지므로).

- [ ] **Step 6: `.claude/HANDOFF.md` 갱신**

§0 한 줄 현황·§1(먼저 읽을 것)·§2(지난 작업)를 갤러리 완료로 갱신하고, 다음 세션 최우선 작업을
"Phase 2 완료 — Phase 3(준비영역 모아보기·설정) 착수 전 사용자 승인" 등으로 바꾼다(지난 세션 기록을
덧붙이지 않고 그 자리에서 고쳐 쓴다 — HANDOFF.md 자체 규칙). §4(열린 질문)에서 "갤러리 사진 원본
저장 위치" 항목을 "1GB 근접 시 용량 경고 UI까지 구현 완료, 실제 외부 전환 로직은 여전히 미정"으로
갱신.

- [ ] **Step 7: 최종 커밋**

```bash
git add docs/04-dev-plan.md .claude/CLAUDE.md .claude/HANDOFF.md
git commit -m "docs: 갤러리(gallery) 슬라이스 완료 반영 — 04 체크박스·CLAUDE.md·HANDOFF.md"
```

---

## 하지 않는 것 (스펙과 동일, 재확인)

- 영상 업로드/분류 — `is_video`는 항상 `false`. 범위 밖.
- 카메라 촬영 업로드 — 갤러리 선택만. 범위 밖.
- 원본 내보내기(zip) — 범위 밖.
- 영역 재분류·캡션 편집 — 업로드 시 1회 선택 후 고정.
- 1GB 초과 시 외부 저장소 전환 로직 — 경고 UI만 이번에 구현, 실제 전환은 경고가 실제로 뜨는 시점에
  다시 판단.

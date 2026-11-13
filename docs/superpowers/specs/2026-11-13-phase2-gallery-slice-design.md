# Phase 2 갤러리(gallery) 슬라이스 — 설계 스펙

작성일: 2026-11-13 · 상태: 승인됨(사용자) · 범위: Phase 2(정보/장부) 중 갤러리

## 왜 이 문서인가 (Context)

Phase 2 세 기능(업체·하객·갤러리) 중 업체·하객은 실구현+실기기/웹 CRUD 검증까지 끝났다. 갤러리는
`app/gallery.tsx`가 아직 `PlaceholderScreen` 스텁이고, DB엔 `photo` 테이블(0001에서 이미 생성,
`get_couple_snapshot`의 `photos` 슬라이스·`trg_bc_photo` 브로드캐스트도 연결됨)만 있다 — 쓰기 RPC·
Storage 버킷·업로드 코드는 전부 없다.

## 결정된 전제 (브레인스토밍 2026-11-13 — 바뀌면 이 문서부터 고친다)

1. **사진만, 영상은 범위 밖**(사용자 결정) — `photo.is_video`는 항상 `false`로만 쓴다. 목업의
   "영상" 통계 셀·재생 배지는 이번 구현에서 뺀다.
2. **업로드는 기기 갤러리 선택만**(`expo-image-picker`), 카메라 촬영은 범위 밖.
3. **Storage 1GB 근접 시 용량 경고 UI** — 800MB(80%) 이상이면 상단에 경고 배너를 보여준다. 숫자는
   `features/gallery/api.ts`의 상수로 둔다(사용자 설정 아님, 바뀌면 코드 수정).
4. **"원본 내보내기"(zip)는 범위 밖** — 목업의 `.io-row`(상단 "사진 올리기"+"원본 내보내기" 버튼 2개)
   는 통째로 구현하지 않는다. 업로드 진입점은 업체·하객과 동일하게 **FAB "사진 추가" 하나로
   통일**한다(목업은 `.io-row`와 FAB 둘 다에 업로드 동작이 있어 모호하다 — 다른 화면과의 일관성을
   위해 FAB로 고정).
5. **사진 탭 동작 = 원본 보기 + 삭제만** — 전체화면 미리보기 모달 + "삭제" 버튼. 영역 재분류·캡션
   편집 UI는 없다(스키마의 `caption` 컬럼은 손대지 않고 둔다 — "세부 기능은 구현 후 개선" 방침).
6. **영역은 업로드 시 1회 선택, 이후 고정** — 업로드 모달에서 영역(6개 중 1개, 필수)을 고르고
   `create_photo`에 `area_id`로 넘긴다. 업로드 후 영역 변경 불가(결정 5와 동일 이유).
7. **Storage 접근 모델**: ADR-0007 — `photos` 버킷, 경로 `{couple.id}/{uuid}.{ext}`, RLS는
   "경로 첫 세그먼트가 존재하는 couple.id인가"만 검사. 클라이언트가 Storage SDK로 직접 업로드/
   다운로드/삭제하고, `photo` 행은 `create_photo`/`delete_photo` RPC로 쓴다(ADR-0003의 유일한
   예외 — RPC 게이트웨이가 아니라 경로 기반 RLS).
8. **용량 계산을 위해 `photo.size_bytes` 컬럼 신설**(스키마 변경, `0008_*.sql`) — 업로드 시 파일
   크기를 바이트로 저장, 상단 통계·경고 임계값 계산에 쓴다. 기존 행 없음(아직 사진 0장)이라
   하위 호환 이슈 없음.
9. **읽기 = 단일 스냅샷 셀렉터**(ADR-0003) — `useCoupleSnapshot` 위에 얹는다. `photos` 슬라이스는
   이미 0001에 있다.
10. **UI는 승인된 목업 이식**(영상 관련 요소 제외) — `design/gallery.html` 구조(상단 통계+업로드
    버튼+영역 필터+영역별 3열 그리드+FAB). 공용 프리미티브(`AreaFilter`·`Fab`) 재사용. 네이티브 헤더
    push 화면 패턴(`PageHead` 중복 금지, `Fab bottomInset` 필수).

## 산출물

### ① 마이그레이션 — `supabase/migrations/0008_gallery.sql`

**스키마 변경**: `alter table photo add column size_bytes bigint not null default 0;`

**Storage**: `insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict do nothing;` + `storage.objects`에 `photos_rw` 정책 3개(insert/select/delete, ADR-0007
조건).

**쓰기 RPC**(전부 security-definer·`p_share_code` 해소·PT401·`grant ... to anon`):

| RPC | 인자 | 동작 |
|---|---|---|
| `create_photo` | `p_share_code, p_area_id, p_storage_path, p_size_bytes, p_caption default null, p_taken_at default null` | `is_video`는 항상 `false`로 insert |
| `delete_photo` | `p_share_code, p_id` | `photo` 행 삭제 |

**삭제 순서 고정**: 클라이언트는 Storage 오브젝트를 먼저 지우고(ADR-0007, 직접 접근) 성공한 뒤에
`delete_photo`로 행을 지운다. 순서가 바뀌면(행 먼저 삭제) 오브젝트만 고아로 남고 가리킬 행이 없어
재시도가 어려워진다 — 오브젝트 먼저 지우는 순서를 고정하면, 행 삭제가 실패해도 "사진 1장이 보이는데
파일은 없는" 상태가 아니라 "사진은 안 보이는데 Storage에 미세한 잔여 용량"만 남아 더 안전하게
재시도할 수 있다.

**스키마 외 변경 없음** — `photo` 테이블 자체(size_bytes 제외)·`get_couple_snapshot`의 `photos`
슬라이스·`trg_bc_photo`는 0001에서 이미 존재.

### ② RPC 래퍼 — `src/lib/rpc.ts`

①의 RPC별 타입드 래퍼 추가(`createPhoto`/`deletePhoto`).

### ③ Storage 업로드 글루 — `src/features/gallery/upload.ts`

RN 전용 레이어(하객 `excel-io.ts`와 동일 역할 — expo-image-picker/expo-file-system/
base64-arraybuffer/supabase Storage SDK는 여기서만 import, 코어는 이 파일을 모른다):
- `pickImage()`: `expo-image-picker`로 1장 선택(취소 시 null), `expo-file-system/legacy`
  `getInfoAsync`로 바이트 크기 확인.
- `uploadPhoto(coupleId, areaId, asset)`: base64 읽기 → `base64-arraybuffer`로 ArrayBuffer 변환 →
  `supabase.storage.from('photos').upload(\`${coupleId}/${uuid}.${ext}\`, buffer, { contentType })`
  → 성공 시 `storage_path` 반환.
- `deletePhotoFile(storagePath)`: `supabase.storage.from('photos').remove([storagePath])`.

### ④ 도메인 로직 — `src/features/gallery/`

- `types.ts`: `AreaPhotoGroup`(영역별 `{ area, photos: Photo[] }`).
- `api.ts`(순수 코어): `selectPhotosByArea(snapshot, areas)` → `AreaPhotoGroup[]`(영역 순서는
  `area.sort_order`, 사진 없는 영역도 빈 배열로 포함 — 업체와 동일 패턴), `totalSizeBytes(snapshot)`,
  `isNearStorageLimit(totalBytes)`(800MB 상수 비교), `hasVisiblePhotos(groups, areaFilter)`(업체
  슬라이스에서 발견된 "필터링 후 빈 상태" 함정을 처음부터 피한다 — `docs/02-architecture.md` 업체
  서브섹션 참고). 쓰기 위임: `createPhoto`/`deletePhoto`.
- `cache.ts`(순수·불변): `applyCreate`·`applyDelete`(스냅샷 패치).
- `hooks.ts`: 업체/하객과 동일 구조 — 읽기 훅 + 쓰기 뮤테이션 훅(`Alert` 에러 표시, 실패 시 Storage
  오브젝트가 이미 올라갔는데 행 생성이 실패하는 경우를 대비해 메시지에 "다시 시도해도 안전합니다"
  수준의 안내는 넣지 않는다 — orphan 오브젝트는 용량에 아주 미미하게만 영향, 재시도가 더 큰 혼란을
  막는다).
- `components/`: `storage-usage-banner.tsx`(상단 통계 3칸 — 전체 장수/영상 칸 제외하고 2칸: 전체·
  원본 보관 용량 — + 800MB 이상이면 경고 문구), `photo-grid.tsx`(목업 `.photo-grid`, 3열 정사각
  그리드), `photo-viewer-modal.tsx`(전체화면 미리보기 + 삭제), `photo-upload-sheet.tsx`(영역 선택 +
  `pickImage`+업로드 트리거, 업로드 중 로딩 상태).

### ⑤ 화면 — `src/app/gallery.tsx`

`PlaceholderScreen` 교체. 하객·업체와 동일한 push 화면 골격. 상단 `storage-usage-banner` → 영역
필터(`AreaFilter` 재사용) → 영역별 섹션(`gal-head` + `photo-grid`) → FAB "사진 추가"(업로드 시트
오픈). 빈 상태(해당 영역에 사진 없음) 문구 — `hasVisiblePhotos`로 전체/필터 양쪽 다 처리(업체 버그
재발 방지).

### ⑥ 테스트 — jest

- `api.test.ts`: `selectPhotosByArea`(영역별 분리·빈 영역 포함·정렬, 보존성)·`totalSizeBytes`(합산,
  빈 배열=0)·`isNearStorageLimit`(경계값 799MB/800MB/801MB)·`hasVisiblePhotos`(전체/필터/빈 케이스 —
  업체와 동일한 4케이스 패턴).
- `cache.test.ts`: 리듀서 멱등성·보존성·병리(없는 id 삭제).
- `upload.ts`는 RN 전용 I/O라 하객 `excel-io.ts`와 동일하게 **단위테스트 대상에서 제외**(통합 성격 —
  실기기/웹에서 실측).

## 유닛 경계

| 유닛 | 하는 일 | 의존 |
|---|---|---|
| `0008_gallery.sql` | `size_bytes` 컬럼·Storage 버킷/정책·사진 쓰기 RPC 2종 | photo·storage.objects |
| `lib/rpc` 래퍼(갤러리분) | RPC 호출 타입드화 | supabase·types/db |
| `features/gallery/upload.ts` | Storage 직접 업로드/삭제(RN 글루) | expo-image-picker·expo-file-system·supabase Storage SDK |
| `features/gallery/cache.ts` | 스냅샷 불변 패치(순수) | types/db only |
| `features/gallery/api.ts` | 도메인 읽기·쓰기(코어) | lib/rpc |
| `features/gallery/hooks.ts` | Query/Mutation 배선 | couple/hooks·api·cache·upload |
| `features/gallery/components` | 화면 전용 UI | components/ui·hooks |
| `app/gallery.tsx` | 조립 | features/gallery |

## 하지 않는 것 (경계)

- **영상 업로드/분류** — `is_video` 컬럼은 손대지 않고 항상 `false`. 범위 밖(아직 안 함).
- **카메라 촬영 업로드** — 갤러리 선택만. 범위 밖.
- **원본 내보내기(zip)** — 범위 밖.
- **영역 재분류·캡션 편집** — 업로드 시 1회 선택 후 고정. `caption` 컬럼은 스키마에 남지만 UI 없음.
- **1GB 초과 시 외부 저장소 전환** — ADR-0002가 "결정 지점"만 남긴 항목, 경고 UI만 이번에 채운다.
  실제 전환 로직·UI는 경고가 실제로 뜨는 시점에 다시 판단(`HANDOFF.md` §4).

## 검증 (완료 판정)

- `npx tsc --noEmit` 0에러 · `npm test` 통과 · `npx eslint src` 0건.
- 0008 라이브 적용(사용자가 Supabase SQL Editor에서 직접 실행) 후 RPC·Storage 왕복 실측 — 업로드
  (갤러리 선택 → 미리보기 → 영역 선택 → 저장)·그리드 반영·전체화면 보기·삭제(Storage 오브젝트+행
  둘 다 사라지는지)·영역 필터(전체/개별, 빈 영역 포함)·800MB 이상일 때 경고 배너 노출(테스트 데이터로
  강제 재현).
- 미검증으로 남을 것: Realtime 두 기기 교차 반영(기존 보류 항목에 갤러리 추가), 실기기(Expo Go)에서의
  `expo-image-picker` 권한 플로우(웹 프리뷰는 `<input type=file>`로 대체되므로 네이티브 권한 요청
  UX는 별도 확인 필요).

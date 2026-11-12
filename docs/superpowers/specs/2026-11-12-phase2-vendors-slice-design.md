# Phase 2 업체(vendors) 슬라이스 — 설계 스펙

작성일: 2026-11-12 · 상태: 승인됨(사용자) · 범위: Phase 2(정보/장부) 중 업체 관리

## 왜 이 문서인가 (Context)

Phase 2 세 기능(업체·하객·갤러리) 중 하객은 실구현·실기기 검증까지 완료됐다. 업체는 아직
`app/vendors.tsx`가 `PlaceholderScreen` 스텁이고, DB엔 `vendor` 테이블과 비용 화면이 쓰는 최소
`create_vendor(share_code, area_id, name)`만 있다(`status='CONTRACTED'` 고정, 비용 화면에서 지출에
업체를 인라인으로 묶을 때 쓴다). 업체 화면 자체의 CRUD(후보 추가·계약 전환·수정·삭제)는 없다.

ADR-0001(업체·비용 경계)로 업체는 **정보 관리 전용** — 금액은 비용(`expense`)이 단일 원장이고,
업체의 `quoted_price`는 참고값일 뿐이다. 이 경계 위에서 하객 슬라이스와 동일한 패턴
(`api.ts`+`cache.ts`+`hooks.ts`+`components/`, 낙관적 캐시, `Alert` 에러 표시)을 재적용한다.

## 결정된 전제 (브레인스토밍 2026-11-12 — 바뀌면 이 문서부터 고친다)

1. **`create_vendor` 통합 확장**(별도 함수 신설 아님) — 기존 호출(`area_id, name`만)과 호환되게
   나머지 필드는 전부 `default`. 업체 화면은 "후보 추가" 시 `p_status='CANDIDATE'`를 명시로 넘긴다.
2. **상태 전환 = 후보 행 탭 → 편집 모달 → "계약 확정" 버튼** — 목업처럼 "계약 확정" 패널과 "후보"
   리스트가 시각적으로 분리돼 있지만, 상태를 바꾸는 조작은 전용 토글이 아니라 **모달 안의 명시적
   버튼**이다. 계약 패널 쪽 편집 모달에는 "계약 확정" 대신 "후보로 되돌리기"(보조 버튼)를 둔다.
3. **"비용에서 보기"는 지출 상세로 즉시 진입** — 목업의 `budget.html` 평면 링크 대신, 연결된
   `expense`를 찾아 비용 탭으로 이동 후 `ExpenseDetail` 모달을 자동으로 연다(비용 화면이 리스트
   스크롤이 아니라 아코디언+모달 구조라 "스크롤/하이라이트"보다 "모달 직행"이 실제 구조에 맞다).
   연결된 지출이 없으면(계약만 하고 비용에 아직 등록 안 함) 버튼을 숨긴다.
4. **삭제 가드** — `expense.vendor_id`가 참조 중인 업체는 삭제를 막는다(`on delete set null`로
   그냥 지우면 `title`이 없는 연결 지출이 `expense_direct_has_title` 체크 제약을 위반할 수 있다).
   앱 레이어에서 먼저 "연결된 지출이 있어 삭제할 수 없습니다"를 명확히 보여준다.
5. **`role` 필드는 폼 레벨 가드** — DB 제약이 아니라(기존 스키마에도 없음), 선택된 영역이
   `area.code==='SDM'`일 때만 폼에 노출한다.
6. **목업의 상세 서브텍스트(보증인원·식대 등)는 모델링하지 않는다** — `vendor.memo`(기존 필드)에
   자유 텍스트로 담는다. "세부 기능은 구현 후 테스트로 개선" 방침(CLAUDE.md 「현재 상태」)에 따라
   후보별 전용 필드를 새로 만들지 않는다.
7. **UI는 승인된 목업 이식** — `design/vendors.html` 구조(영역 필터+계약 패널+후보 리스트+FAB).
   공용 프리미티브(`Chip`·`Fab`·영역 필터는 `checklist/components/area-filter.tsx` 재사용 — 새로
   안 만든다) 재사용. 네이티브 헤더 push 화면 패턴(`PageHead` 중복 금지, `Fab bottomInset` 필수).
8. **읽기 = 단일 스냅샷 셀렉터**(ADR-0003) — `useCoupleSnapshot` 위에 얹는다.

## 산출물

### ① 마이그레이션 — `supabase/migrations/0007_vendor_writes.sql`

**쓰기 RPC**(전부 security-definer·`p_share_code` 해소·PT401/PT404·`grant ... to anon`):

| RPC | 인자 | 동작 |
|---|---|---|
| `create_vendor` | `p_share_code, p_area_id, p_name, p_status default 'CONTRACTED', p_role default null, p_location default null, p_contract_date default null, p_quoted_price default null, p_memo default null` | 기존 비용 화면 호출(3개 인자)과 호환. 업체 화면은 `p_status='CANDIDATE'` 명시 |
| `update_vendor` | `p_share_code, p_id, p_name, p_status, p_role, p_location, p_contract_date, p_quoted_price, p_memo` | 전체 필드 갱신. "계약 확정"/"후보로 되돌리기"도 이 함수로 `p_status` 변경 |
| `delete_vendor` | `p_share_code, p_id` | `expense.vendor_id`로 참조 중이면 에러(errcode `PT409`)로 거부 |

**스키마 변경 없음** — `vendor` 테이블·`get_couple_snapshot`의 `vendors` 슬라이스·`trg_bc_vendor`
브로드캐스트 트리거는 0001에서 이미 존재. 이번 슬라이스는 쓰기 RPC만 추가한다(체크리스트·일정과
동일한 "쓰기 RPC만" 패턴 — 비용과 다름).

### ② RPC 래퍼 — `src/lib/rpc.ts`

①의 RPC별 타입드 래퍼 추가. 기존 `createVendor`(비용 화면이 쓰는 3-인자 버전)는 시그니처를
유지한 채 내부에서 신규 옵셔널 필드를 `undefined`로 넘기거나, 업체 전용 입력 타입을 받는 오버로드로
확장한다(비용 화면 호출부 수정 불필요).

### ③ 도메인 로직 — `src/features/vendors/`

- `types.ts`: `VendorFormValue`(모달 입력), `AreaVendorGroup`(영역별 `{ area, contracted: Vendor[],
  candidates: Vendor[] }`).
- `api.ts`(순수 코어): `selectVendors(snapshot)`, `selectVendorsByArea(snapshot)` → `AreaVendorGroup[]`
  (영역 순서는 `area.sort_order`), `findLinkedExpense(snapshot, vendorId)` → `Expense | null`(비용
  연동용). 쓰기 위임: `createVendor`/`updateVendor`/`deleteVendor`/`setVendorContracted`(status=
  CONTRACTED+contract_date를 한 번에 넘기는 헬퍼, 내부적으로 updateVendor 호출)/`setVendorCandidate`.
- `cache.ts`(순수·불변): `applyCreate`·`applyUpdate`·`applyDelete`(스냅샷 패치, 체크리스트/하객과
  동일한 리듀서 모양).
- `hooks.ts`: 하객의 `useGuestMutation`과 동일 구조(공유 추상화로 올리지 않음 — 세 번째 반복이지만
  YAGNI 선례 유지, 기존 두 슬라이스도 각자 들고 있다). 읽기 훅 + 쓰기 뮤테이션 훅.
- `components/`: `vendor-contract-panel.tsx`(목업 `.signed`, 역할 칩+이름+견적가+"비용에서 보기")·
  `vendor-candidate-row.tsx`(목업 `.list .quote`)·`vendor-form.tsx`(단일 모달 — 영역·역할(SDM만)·
  이름·위치·계약일(`CalendarPicker`)·계약 견적가(`money.ts`)·메모 + 하단 액션(신규: "추가" · 후보
  편집: "저장"+"계약 확정"+"삭제" · 계약 편집: "저장"+"후보로 되돌리기"+"삭제")).

### ④ 화면 — `src/app/vendors.tsx`

`PlaceholderScreen` 교체. 하객과 동일한 push 화면 골격(`SafeAreaView edges={['bottom']}`, 네이티브
헤더가 제목+뒤로가기 제공). 영역 필터(`AreaFilter` 재사용) → 영역별 섹션(계약 패널 0개 이상 +
"검토했던 후보" 리스트) → FAB "업체 추가". 빈 상태(해당 영역에 업체 없음) 문구.

### ⑤ 비용 연동 — `src/app/(tabs)/budget.tsx` 보강

`useLocalSearchParams<{ expenseId?: string }>()`로 받아 마운트 시(및 `expenseId` 변경 시)
`setDetailId(expenseId)` 호출하는 `useEffect` 1줄 추가. `vendor-contract-panel.tsx`의 "비용에서
보기" 버튼은 `findLinkedExpense`로 찾은 expense가 있을 때만 노출하고
`router.push({ pathname: '/(tabs)/budget', params: { expenseId } })`.

### ⑥ 테스트 — jest

- `api.test.ts`: `selectVendorsByArea`(영역별 계약/후보 분리·빈 영역 제외 여부·정렬)·`findLinkedExpense`
  (있음/없음/여러 지출 중 매칭 1건). 보존성(개수·순서).
- `cache.test.ts`: 리듀서 멱등성·보존성·병리(없는 id 수정/삭제)·상태 전환(CANDIDATE→CONTRACTED
  전후 필드 보존).

## 유닛 경계

| 유닛 | 하는 일 | 의존 |
|---|---|---|
| `0007_*.sql` | 업체 쓰기 RPC 3종 | vendor/expense(FK 체크만) |
| `lib/rpc` 래퍼(업체분) | RPC 호출 타입드화 | supabase·types/db |
| `features/vendors/cache.ts` | 스냅샷 불변 패치(순수) | types/db only |
| `features/vendors/api.ts` | 도메인 읽기·쓰기(코어) | lib/rpc |
| `features/vendors/hooks.ts` | Query/Mutation 배선 | couple/hooks·api·cache |
| `features/vendors/components` | 화면 전용 UI | components/ui·hooks |
| `app/vendors.tsx` | 조립 | features/vendors |
| `app/(tabs)/budget.tsx`(보강) | `expenseId` 파라미터로 상세 모달 자동 오픈 | 기존 구조 그대로, 1개 effect만 추가 |

## 하지 않는 것 (경계)

- **금액 상세(옵션·납부) 관리** — ADR-0001대로 비용 화면 소관. 업체 화면은 `quoted_price` 참고값만.
- **후보별 세부 속성(보증인원·식대 등 목업 서브텍스트)** — `memo` 자유 텍스트로 대체, 전용 필드 없음.
- **갤러리** — 독립 슬라이스, 이 스펙 범위 밖.
- **Realtime 두 기기 교차 반영 검증** — Phase 1부터 이어지는 별도 미검증 항목, 이 슬라이스에서 새로
  확인하지 않는다(브로드캐스트 트리거 자체는 0001에서 이미 연결돼 있다).

## 검증 (완료 판정)

- `npx tsc --noEmit` 0에러 · `npm test` 통과 · `npx eslint src` 0건.
- 0007 라이브 적용(사용자가 Supabase SQL Editor에서 직접 실행) 후 RPC 왕복 실측 — 생성(후보/계약
  양쪽 상태)·수정·삭제(연결 지출 있을 때 거부되는지 포함)·격리(다른 share_code 교차 차단).
- 기기/웹 CRUD 경계 포함 실측: 빈 상태 첫 업체(후보) 추가 → 계약 확정 전환 → 수정 → 연결 지출 있는
  업체 삭제 시도(거부 확인) → 연결 없는 업체 삭제. 영역 필터 전체/개별 전환.
- "비용에서 보기" → 비용 탭 이동 + 해당 지출 상세 모달 자동 오픈 실측(연결 지출 없는 업체는 버튼
  숨김 확인).
- 미검증으로 남을 것: Realtime 두 기기 교차 반영(기존 보류 항목에 업체 추가).

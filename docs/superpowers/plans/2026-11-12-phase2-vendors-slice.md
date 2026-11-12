# 업체(vendors) 슬라이스 구현 계획 (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 업체 화면(`app/vendors.tsx`)을 실데이터 CRUD로 동작시킨다 — 영역 필터 + 계약 패널(여러 개)
+ 후보 리스트 + 상태 전환(후보↔계약) + 비용 화면으로 "바로 지출 보기" 연동.

**Architecture:** 체크리스트·일정·하객과 동일한 패턴. 커플 데이터는 RPC 게이트웨이로만 접근
(ADR-0003). 읽기는 단일 스냅샷 위 셀렉터, 쓰기는 `p_share_code`로 서버가 couple_id를 해소하는
security-definer RPC. TanStack `useMutation`이 스냅샷 캐시를 순수 리듀서(`cache.ts`)로 낙관적
패치하고 실패 시 롤백 + `Alert`(ADR-0001 — 업체는 정보 전용, 금액은 `quoted_price` 참고값만).

**Tech Stack:** Expo SDK 58 / React Native 0.88 / Expo Router / TanStack Query v5 / Supabase(Postgres
RPC) / jest-expo.

**설계 스펙:** `docs/superpowers/specs/2026-11-12-phase2-vendors-slice-design.md`

---

## 파일 구조 (생성/수정)

| 파일 | 책임 | 작업 |
|---|---|---|
| `supabase/migrations/0007_vendor_writes.sql` | `create_vendor` 통합 확장 + `update_vendor`·`delete_vendor` 신설 | 생성 |
| `src/lib/rpc.ts` | RPC 래퍼 3종 추가(`createVendorFull`·`updateVendor`·`deleteVendor`) | 수정 |
| `src/features/vendors/api.ts` | 셀렉터 + 라벨 맵 + 쓰기 위임 | 생성 |
| `src/features/vendors/api.test.ts` | 셀렉터 단위 테스트 | 생성 |
| `src/features/vendors/cache.ts` | 스냅샷 낙관적 패치 순수 리듀서 | 생성 |
| `src/features/vendors/cache.test.ts` | 리듀서 단위 테스트 | 생성 |
| `src/features/vendors/hooks.ts` | 읽기·쓰기 훅 | 생성 |
| `src/features/vendors/components/vendor-form.tsx` | 추가/수정/상태전환 모달 | 생성 |
| `src/features/vendors/components/vendor-contract-panel.tsx` | 계약 패널(목업 `.signed`) | 생성 |
| `src/features/vendors/components/vendor-candidate-row.tsx` | 후보 리스트 행 | 생성 |
| `src/features/vendors/index.ts` | 배럴 | 생성 |
| `src/app/vendors.tsx` | 화면 조립(`PlaceholderScreen` 교체) | 수정 |
| `src/app/(tabs)/budget.tsx` | `expenseId` 파라미터로 상세 모달 자동 오픈 | 수정 |
| `docs/04-dev-plan.md`·`.claude/CLAUDE.md`·`.claude/HANDOFF.md` | 체크박스/현재 상태 갱신 | 수정 |

---

## Task 1: 마이그레이션 — `0007_vendor_writes.sql`

**Files:**
- Create: `supabase/migrations/0007_vendor_writes.sql`

- [ ] **Step 1: 파일 작성**

Create `supabase/migrations/0007_vendor_writes.sql`:
```sql
-- Phase 2 업체(vendors) 슬라이스 — 업체 쓰기 RPC 확장(ADR-0003 / ADR-0001).
-- vendor 테이블·enum(vendor_status/vendor_role)·인덱스·RLS·broadcast 트리거(trg_bc_vendor)와
-- get_couple_snapshot의 'vendors' 슬라이스는 0001에 이미 있다 → 여기선 쓰기 RPC만 추가/확장한다.
-- create_vendor는 0004(비용 화면 인라인 생성, 3-인자)가 이미 있다. Postgres는 인자 "타입 목록"이
-- 다르면 CREATE OR REPLACE도 같은 함수를 치환하는 게 아니라 별도 오버로드를 새로 만든다 —
-- 3-인자 버전을 지우지 않고 9-인자(default) 버전만 추가하면 두 함수가 동시에 존재해, 3개
-- 인자만 넘기는 기존 호출(비용 화면)이 "function is not unique" 모호성 에러로 깨진다. 그래서
-- 먼저 3-인자 버전을 DROP하고, 그 이름 자리를 9-인자(나머지 default) 버전 하나로 대체한다.
-- forward-only: 0001~0006이 적용된 프로젝트의 SQL Editor에 전체를 1회 실행.

-- ===========================================================================
-- 1. create_vendor 확장 — status/role/location/contract_date/quoted_price/memo를 선택 인자로 추가
--    (기존 3-인자 오버로드를 먼저 지워 모호성을 없앤다 — 위 주석 참고)
-- ===========================================================================
drop function if exists public.create_vendor(text, uuid, text);

create or replace function public.create_vendor(
  p_share_code text, p_area_id uuid, p_name text,
  p_status vendor_status default 'CONTRACTED', p_role vendor_role default null,
  p_location text default null, p_contract_date date default null,
  p_quoted_price bigint default null, p_memo text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row vendor%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into vendor (couple_id, area_id, name, status, role, location, contract_date, quoted_price, memo)
    values (v_couple, p_area_id, p_name, p_status, p_role, p_location, p_contract_date, p_quoted_price, p_memo)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

-- ===========================================================================
-- 2. update_vendor — 전체 필드 갱신(상태 전환 CANDIDATE↔CONTRACTED도 이 함수 하나로)
-- ===========================================================================
create or replace function public.update_vendor(
  p_share_code text, p_id uuid, p_name text, p_status vendor_status,
  p_role vendor_role, p_location text, p_contract_date date, p_quoted_price bigint, p_memo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row vendor%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update vendor set
    name = p_name, status = p_status, role = p_role, location = p_location,
    contract_date = p_contract_date, quoted_price = p_quoted_price, memo = p_memo
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'vendor not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

-- ===========================================================================
-- 3. delete_vendor — expense.vendor_id가 참조 중이면 거부(PT409). on delete set null로 그냥
--    지우면 title 없는 연결 지출이 expense_direct_has_title 체크 제약을 위반할 수 있어, 먼저
--    명확한 에러로 "연결된 지출이 있다"를 알린다.
-- ===========================================================================
create or replace function public.delete_vendor(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  if exists (select 1 from expense where vendor_id = p_id and couple_id = v_couple) then
    raise exception '연결된 지출이 있어 삭제할 수 없습니다. 비용에서 먼저 지출을 정리하세요.' using errcode = 'PT409';
  end if;
  delete from vendor where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'vendor not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

-- ===========================================================================
-- 4. 실행 권한 — anon이 호출 가능(share_code를 가진 커플만 자기 데이터 쓰기)
-- ===========================================================================
grant execute on function public.create_vendor(text,uuid,text,vendor_status,vendor_role,text,date,bigint,text) to anon;
grant execute on function public.update_vendor(text,uuid,text,vendor_status,vendor_role,text,date,bigint,text) to anon;
grant execute on function public.delete_vendor(text,uuid) to anon;
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/0007_vendor_writes.sql
git commit -m "feat(db): 업체 쓰기 RPC 확장 — create_vendor 통합, update_vendor·delete_vendor 신설"
```

**⚠️ 사용자 작업 필요**: 이 파일은 코드 커밋만으로 반영되지 않는다. 이 저장소는 Supabase CLI
링크가 없으므로(`supabase/config.toml` 부재), **사용자가 Supabase 대시보드 SQL Editor에 이 파일
전체를 붙여넣어 직접 실행**해야 한다(HANDOFF.md 함정 — 하객 0006·비용 0005 선례). Task 7(쓰기
훅)부터는 이 마이그레이션이 라이브 적용된 뒤에야 실기기/웹에서 동작을 실측할 수 있다.

---

## Task 2: RPC 래퍼 — `src/lib/rpc.ts`

**Files:**
- Modify: `src/lib/rpc.ts`

- [ ] **Step 1: import 정리 — 기존 `CreateVendorInput` 임포트에 별칭 부여**

기존(약 6번째 줄 근처) import:
```ts
import type {
  AddPaymentInput, CreateExpenseInput, CreateVendorInput, OptionInput, UpdateExpenseInput,
  UpdatePaymentInput,
} from '@/features/budget/api';
```
다음으로 교체(비용 화면의 최소 생성 타입과 업체 화면의 전체 입력 타입이 이름이 겹치므로, 비용
쪽을 별칭으로 — `budget/api.ts`·호출부는 전혀 안 건드린다):
```ts
import type {
  AddPaymentInput, CreateExpenseInput, CreateVendorInput as CreateVendorInlineInput, OptionInput,
  UpdateExpenseInput, UpdatePaymentInput,
} from '@/features/budget/api';
```
그리고 기존 `createVendor` 함수 시그니처의 `CreateVendorInput`을 `CreateVendorInlineInput`으로 바꾼다:
```ts
export async function createVendor(shareCode: string, input: CreateVendorInlineInput): Promise<Vendor> {
  const { data, error } = await supabase.rpc('create_vendor', {
    p_share_code: shareCode, p_area_id: input.areaId, p_name: input.name,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Vendor;
}
```

- [ ] **Step 2: 업체 화면용 타입 import 추가**

파일 상단 import 블록에 추가:
```ts
import type { CreateVendorInput, UpdateVendorInput } from '@/features/vendors/api';
```

- [ ] **Step 3: 새 래퍼 3종 추가**

`createVendor` 함수 바로 아래에 추가:
```ts
export async function createVendorFull(shareCode: string, input: CreateVendorInput): Promise<Vendor> {
  const { data, error } = await supabase.rpc('create_vendor', {
    p_share_code: shareCode, p_area_id: input.areaId, p_name: input.name,
    p_status: input.status ?? 'CANDIDATE', p_role: input.role ?? null,
    p_location: input.location ?? null, p_contract_date: input.contractDate ?? null,
    p_quoted_price: input.quotedPrice ?? null, p_memo: input.memo ?? null,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Vendor;
}

export async function updateVendor(shareCode: string, input: UpdateVendorInput): Promise<Vendor> {
  const { data, error } = await supabase.rpc('update_vendor', {
    p_share_code: shareCode, p_id: input.id, p_name: input.name, p_status: input.status,
    p_role: input.role ?? null, p_location: input.location ?? null,
    p_contract_date: input.contractDate ?? null, p_quoted_price: input.quotedPrice ?? null,
    p_memo: input.memo ?? null,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Vendor;
}

export async function deleteVendor(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_vendor', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}
```

- [ ] **Step 4: tsc 확인(아직 features/vendors/api가 없어 에러 나는 게 정상)**

Run: `npx tsc --noEmit`
Expected: `src/lib/rpc.ts`에서 `Cannot find module '@/features/vendors/api'` 에러. Task 3에서 해소된다 —
지금 단계에서는 이 에러만 나면 정상(다른 에러 없음 확인).

- [ ] **Step 5: 커밋은 Task 3과 함께**(features/vendors/api.ts 없이는 타입체크가 깨져 있어 중간
  상태를 단독 커밋하지 않는다 — Task 3의 커밋에 포함)

---

## Task 3: 도메인 코어 — `src/features/vendors/api.ts` (TDD)

**Files:**
- Create: `src/features/vendors/types.ts`
- Create: `src/features/vendors/api.ts`
- Create: `src/features/vendors/api.test.ts`

- [ ] **Step 1: 뷰 타입**

Create `src/features/vendors/types.ts`:
```ts
import type { Area, Vendor } from '@/types/db';

// types/db.ts(행 타입)를 넘어서는 뷰·파생 타입만 둔다.

// 영역별 업체 묶음 — 계약 확정(여러 개 가능, 스드메=스튜디오/드레스/메이크업)과 후보를 분리.
export type AreaVendorGroup = {
  area: Area;
  contracted: Vendor[];
  candidates: Vendor[];
};
```

- [ ] **Step 2: 실패하는 셀렉터 테스트 작성**

Create `src/features/vendors/api.test.ts`:
```ts
import type { Area, CoupleSnapshot, Expense, Vendor } from '@/types/db';
import { findLinkedExpense, selectVendors, selectVendorsByArea } from './api';

const area = (id: string, order: number, name: string, code: Area['code'] = 'HALL'): Area => ({
  id, created_at: '', code, name_ko: name, sort_order: order,
});
const vendor = (id: string, areaId: string, extra: Partial<Vendor> = {}): Vendor => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, name: id, status: 'CANDIDATE',
  role: null, location: null, contract_date: null, quoted_price: null, memo: null,
  ...extra,
});
const expense = (id: string, vendorId: string | null, extra: Partial<Expense> = {}): Expense => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', vendor_id: vendorId, title: vendorId ? null : 'x',
  base_amount: 0, ...extra,
});
const snap = (vendors: Vendor[], expenses: Expense[] = []): CoupleSnapshot =>
  ({ vendors, expenses } as CoupleSnapshot);

describe('selectVendors', () => {
  test('스냅샷의 vendors를 그대로(새 배열로) 반환, 원본 불변', () => {
    const s = snap([vendor('a', 'area1')]);
    const out = selectVendors(s);
    expect(out).toEqual(s.vendors);
    expect(out).not.toBe(s.vendors);
  });
});

describe('selectVendorsByArea', () => {
  test('area sort_order 순, 영역별로 계약/후보 분리', () => {
    const areas = [area('a2', 2, '스드메', 'SDM'), area('a1', 1, '웨딩홀', 'HALL')];
    const vendors = [
      vendor('v1', 'a1', { status: 'CONTRACTED' }),
      vendor('v2', 'a1', { status: 'CANDIDATE' }),
      vendor('v3', 'a2', { status: 'CANDIDATE' }),
    ];
    const out = selectVendorsByArea(snap(vendors), areas);
    expect(out.map((g) => g.area.id)).toEqual(['a1', 'a2']); // sort_order 순
    expect(out[0].contracted.map((v) => v.id)).toEqual(['v1']);
    expect(out[0].candidates.map((v) => v.id)).toEqual(['v2']);
    expect(out[1].contracted).toEqual([]);
    expect(out[1].candidates.map((v) => v.id)).toEqual(['v3']);
  });

  test('경계: 업체 없는 영역도 빈 배열 2개로 포함(화면이 빈 상태 렌더링 여부를 결정)', () => {
    const areas = [area('a1', 1, '신혼집', 'HOME')];
    const out = selectVendorsByArea(snap([]), areas);
    expect(out).toEqual([{ area: areas[0], contracted: [], candidates: [] }]);
  });
});

describe('findLinkedExpense', () => {
  test('vendor_id로 연결된 지출 1건 반환', () => {
    const s = snap([vendor('v1', 'a1')], [expense('e1', 'v1'), expense('e2', null)]);
    expect(findLinkedExpense(s, 'v1')?.id).toBe('e1');
  });
  test('연결된 지출 없으면 null', () => {
    const s = snap([vendor('v1', 'a1')], [expense('e1', 'v2')]);
    expect(findLinkedExpense(s, 'v1')).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `npm test -- src/features/vendors/api.test.ts`
Expected: FAIL(`Cannot find module './api'` — 아직 파일 없음)

- [ ] **Step 4: 셀렉터 + 쓰기 위임 구현**

Create `src/features/vendors/api.ts`:
```ts
import type { CoupleSnapshot, Expense, Vendor, VendorRole, VendorStatus } from '@/types/db';
import type { Area } from '@/types/db';
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
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `npm test -- src/features/vendors/api.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: 전체 tsc 확인(Task 2에서 남겨둔 에러가 해소됐는지)**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 7: 커밋(Task 2 변경분 포함)**

```bash
git add src/lib/rpc.ts src/features/vendors/types.ts src/features/vendors/api.ts src/features/vendors/api.test.ts
git commit -m "feat(vendors): RPC 래퍼 + 도메인 셀렉터/쓰기 위임(api.ts)"
```

---

## Task 4: 낙관적 캐시 — `src/features/vendors/cache.ts` (TDD)

**Files:**
- Create: `src/features/vendors/cache.ts`
- Create: `src/features/vendors/cache.test.ts`

- [ ] **Step 1: 실패하는 리듀서 테스트 작성**

Create `src/features/vendors/cache.test.ts`:
```ts
import type { CoupleSnapshot, Vendor } from '@/types/db';
import { applyCreate, applyDelete, applyUpdate } from './cache';

const vendor = (id: string, extra: Partial<Vendor> = {}): Vendor => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', name: id, status: 'CANDIDATE',
  role: null, location: null, contract_date: null, quoted_price: null, memo: null,
  ...extra,
});
const snap = (vendors: Vendor[]): CoupleSnapshot => ({ vendors } as CoupleSnapshot);

describe('applyCreate', () => {
  test('맨 뒤에 추가, 나머지 보존', () => {
    const s0 = snap([vendor('a')]);
    const out = applyCreate(s0, vendor('b'));
    expect(out.vendors.map((v) => v.id)).toEqual(['a', 'b']);
    expect(s0.vendors).toHaveLength(1); // 원본 불변
  });
});

describe('applyUpdate', () => {
  test('지정 필드만 교체, 나머지 보존(상태 전환 CANDIDATE→CONTRACTED 포함)', () => {
    const s0 = snap([vendor('a', { status: 'CANDIDATE' })]);
    const out = applyUpdate(s0, {
      id: 'a', name: '새이름', status: 'CONTRACTED', role: 'STUDIO', location: '서울',
      contractDate: '2027-01-01', quotedPrice: 1500000, memo: '메모',
    });
    expect(out.vendors[0]).toMatchObject({
      name: '새이름', status: 'CONTRACTED', role: 'STUDIO', location: '서울',
      contract_date: '2027-01-01', quoted_price: 1500000, memo: '메모',
    });
    expect(s0.vendors[0].status).toBe('CANDIDATE'); // 원본 불변
  });

  test('role/location 등 미지정(undefined)이면 null로 정규화', () => {
    const out = applyUpdate(snap([vendor('a')]), { id: 'a', name: 'x', status: 'CANDIDATE' });
    expect(out.vendors[0].role).toBeNull();
    expect(out.vendors[0].location).toBeNull();
    expect(out.vendors[0].contract_date).toBeNull();
    expect(out.vendors[0].quoted_price).toBeNull();
    expect(out.vendors[0].memo).toBeNull();
  });

  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([vendor('a')]);
    const out = applyUpdate(s0, { id: 'zzz', name: 'x', status: 'CANDIDATE' });
    expect(out.vendors).toEqual(s0.vendors);
  });
});

describe('applyDelete', () => {
  test('해당 id 제거, 나머지 보존', () => {
    const out = applyDelete(snap([vendor('a'), vendor('b')]), 'a');
    expect(out.vendors.map((v) => v.id)).toEqual(['b']);
  });
  test('병리: 없는 id는 개수 불변', () => {
    expect(applyDelete(snap([vendor('a')]), 'zzz').vendors).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm test -- src/features/vendors/cache.test.ts`
Expected: FAIL(`Cannot find module './cache'`)

- [ ] **Step 3: 리듀서 구현**

Create `src/features/vendors/cache.ts`:
```ts
import type { CoupleSnapshot, Vendor } from '@/types/db';
import type { UpdateVendorInput } from './api';

// 스냅샷 캐시 낙관적 패치(순수·불변). CoupleSnapshot을 받아 새 스냅샷을 반환한다.
// 각 함수는 vendors 슬라이스만 교체하고 나머지는 그대로 둔다.

function withVendors(s: CoupleSnapshot, vendors: Vendor[]): CoupleSnapshot {
  return { ...s, vendors };
}

export function applyCreate(s: CoupleSnapshot, vendor: Vendor): CoupleSnapshot {
  return withVendors(s, [...s.vendors, vendor]);
}

export function applyUpdate(s: CoupleSnapshot, patch: UpdateVendorInput): CoupleSnapshot {
  return withVendors(
    s,
    s.vendors.map((v) =>
      v.id === patch.id
        ? {
            ...v,
            name: patch.name,
            status: patch.status,
            role: patch.role ?? null,
            location: patch.location ?? null,
            contract_date: patch.contractDate ?? null,
            quoted_price: patch.quotedPrice ?? null,
            memo: patch.memo ?? null,
          }
        : v,
    ),
  );
}

export function applyDelete(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return withVendors(s, s.vendors.filter((v) => v.id !== id));
}
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

Run: `npm test -- src/features/vendors/cache.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/features/vendors/cache.ts src/features/vendors/cache.test.ts
git commit -m "feat(vendors): 낙관적 캐시 리듀서(cache.ts)"
```

---

## Task 5: Query/Mutation 훅 — `src/features/vendors/hooks.ts`

**Files:**
- Create: `src/features/vendors/hooks.ts`

- [ ] **Step 1: 구현**

Create `src/features/vendors/hooks.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { Area, CoupleSnapshot, Vendor } from '@/types/db';
import * as api from './api';
import * as cache from './cache';

// 하객의 useGuestMutation과 동일 구조(세 번째 반복이지만 공유 추상화로 올리지 않음 — YAGNI 선례).
export function useVendors() {
  return useCoupleSnapshot(api.selectVendors);
}

// 영역 목록은 전역 참조(useAreas)에서 주입 — 스냅샷에 없으므로 인자로 받는다(budget 선례).
export function useVendorsByArea(areas: Area[]) {
  return useCoupleSnapshot((s) => api.selectVendorsByArea(s, areas));
}

function useVendorMutation<TArgs>(
  mutationFn: (code: string, args: TArgs) => Promise<unknown>,
  optimistic: (s: CoupleSnapshot, args: TArgs) => CoupleSnapshot,
) {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: (args: TArgs) => mutationFn(shareCode as string, args),
    onMutate: async (args: TArgs) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CoupleSnapshot>(key);
      if (prev) qc.setQueryData(key, optimistic(prev, args));
      return { prev };
    },
    onError: (e, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      // 조용히 롤백만 하면 "저장됐다가 사라짐"으로 보여 원인을 알 수 없다(체크리스트·일정·비용·
      // 하객 4개 feature와 동일한 교훈 — 삭제 가드(연결된 지출 있음)도 이 Alert로 그대로 드러난다.
      Alert.alert('저장하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCreateVendor() {
  return useVendorMutation<api.CreateVendorInput>(
    (code, input) => api.createVendor(code, input),
    (s, input) => {
      const temp: Vendor = {
        id: `optimistic-${Date.now()}`,
        created_at: new Date().toISOString(),
        couple_id: s.couple.id,
        area_id: input.areaId,
        name: input.name,
        status: input.status ?? 'CANDIDATE',
        role: input.role ?? null,
        location: input.location ?? null,
        contract_date: input.contractDate ?? null,
        quoted_price: input.quotedPrice ?? null,
        memo: input.memo ?? null,
      };
      return cache.applyCreate(s, temp);
    },
  );
}

export function useUpdateVendor() {
  return useVendorMutation<api.UpdateVendorInput>(
    (code, input) => api.updateVendor(code, input),
    (s, input) => cache.applyUpdate(s, input),
  );
}

export function useDeleteVendor() {
  return useVendorMutation<{ id: string }>(
    (code, { id }) => api.deleteVendor(code, id),
    (s, { id }) => cache.applyDelete(s, id),
  );
}
```

- [ ] **Step 2: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 3: 커밋**

```bash
git add src/features/vendors/hooks.ts
git commit -m "feat(vendors): Query/Mutation 훅(hooks.ts)"
```

---

## Task 6: 폼 모달 — `src/features/vendors/components/vendor-form.tsx`

**Files:**
- Create: `src/features/vendors/components/vendor-form.tsx`

- [ ] **Step 1: 구현**

Create `src/features/vendors/components/vendor-form.tsx`:
```tsx
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Chip, DateField, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { parseManInput, sanitizeManInput, wonToMan } from '@/lib/money';
import type { Area, Vendor, VendorRole, VendorStatus } from '@/types/db';
import { ROLE_LABEL } from '../api';

export type VendorFormValue = {
  areaId: string;
  name: string;
  status: VendorStatus;
  role: VendorRole | null;
  location: string | null;
  contractDate: string | null;
  quotedPrice: number | null;
  memo: string | null;
};

const ROLE_OPTS: (VendorRole | null)[] = ['STUDIO', 'DRESS', 'MAKEUP', null];

// 추가(후보)/수정/상태전환 공용 모달. editing이 있으면 수정 모드 — 영역은 생성 시 고정(체크리스트
// 관례), 상태 전환은 "저장"과 분리된 명시적 버튼(계약 확정 / 후보로 되돌리기)으로만 일어난다
// (브레인스토밍 2026-11-12 결정 — 전용 토글 없음).
export function VendorForm({
  visible, areas, editing, defaultAreaId, onSubmit, onDelete, onClose,
}: {
  visible: boolean;
  areas: Area[];
  editing: Vendor | null;
  defaultAreaId: string | null;
  onSubmit: (v: VendorFormValue) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [areaId, setAreaId] = useState(editing?.area_id ?? defaultAreaId ?? areas[0]?.id ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [role, setRole] = useState<VendorRole | null>(editing?.role ?? null);
  const [location, setLocation] = useState(editing?.location ?? '');
  const [contractDate, setContractDate] = useState<string | null>(editing?.contract_date ?? null);
  const [quotedMan, setQuotedMan] = useState(
    editing?.quoted_price != null ? String(wonToMan(editing.quoted_price)) : '',
  );
  const [memo, setMemo] = useState(editing?.memo ?? '');

  const isSdm = areas.find((a) => a.id === areaId)?.code === 'SDM';
  const canSave = name.trim().length > 0 && areaId.length > 0;
  const canContract = canSave && !!contractDate;
  const isContracted = editing?.status === 'CONTRACTED';

  const submit = (status: VendorStatus) => {
    onSubmit({
      areaId, name: name.trim(), status, role: isSdm ? role : null,
      location: location.trim() ? location.trim() : null,
      contractDate, quotedPrice: quotedMan.trim() ? parseManInput(quotedMan) : null,
      memo: memo.trim() ? memo.trim() : null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ maxHeight: '88%', backgroundColor: colors.ground, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <ScrollView contentContainerStyle={{ padding: layout.screenPadding, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text variant="title">{editing ? '업체 수정' : '업체 추가(후보)'}</Text>

          <Field label="영역">
            {editing ? (
              <Chip variant="area" label={areas.find((a) => a.id === areaId)?.name_ko ?? ''} />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {areas.map((a) => (
                  <Pressable key={a.id} onPress={() => { setAreaId(a.id); setRole(null); }}>
                    <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          {isSdm ? (
            <Field label="역할">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {ROLE_OPTS.map((r) => (
                  <Pressable key={r ?? 'none'} onPress={() => setRole(r)}>
                    <Chip variant={role === r ? 'area' : 'ghost'} label={r ? ROLE_LABEL[r] : '미지정'} />
                  </Pressable>
                ))}
              </View>
            </Field>
          ) : null}

          <TextInput
            value={name} onChangeText={setName} placeholder="업체명" placeholderTextColor={colors.inkFaint}
            style={inputStyle}
          />
          <TextInput
            value={location} onChangeText={setLocation} placeholder="위치 (선택)" placeholderTextColor={colors.inkFaint}
            style={inputStyle}
          />

          <Field label="계약 견적(만원, 참고값 — 금액 소스 아님)">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <TextInput
                value={quotedMan} onChangeText={(t) => setQuotedMan(sanitizeManInput(t))}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.inkFaint}
                style={[inputStyle, { flex: 1, textAlign: 'right' }]}
              />
              <Text variant="caption" color="inkMuted">만원</Text>
            </View>
          </Field>

          <Field label="계약일">
            <DateField value={contractDate} onChange={setContractDate} placeholder="계약일 (선택)" />
          </Field>

          <TextInput
            value={memo} onChangeText={setMemo} placeholder="메모 (선택)" placeholderTextColor={colors.inkFaint}
            multiline style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-end' }}>
            {editing && onDelete ? <Button variant="ghost" label="삭제" onPress={onDelete} /> : null}
            <View style={{ flex: 1 }} />
            <Button variant="ghost" label="취소" onPress={onClose} />
            {!editing ? (
              <Button label="추가" onPress={() => submit('CANDIDATE')} disabled={!canSave} />
            ) : isContracted ? (
              <>
                <Button variant="ghost" label="후보로 되돌리기" onPress={() => submit('CANDIDATE')} disabled={!canSave} />
                <Button label="저장" onPress={() => submit('CONTRACTED')} disabled={!canSave} />
              </>
            ) : (
              <>
                <Button variant="ghost" label="계약 확정" onPress={() => submit('CONTRACTED')} disabled={!canContract} />
                <Button label="저장" onPress={() => submit('CANDIDATE')} disabled={!canSave} />
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="bodySm" color="inkMuted">{label}</Text>
      {children}
    </View>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;
```

- [ ] **Step 2: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 3: 커밋**

```bash
git add src/features/vendors/components/vendor-form.tsx
git commit -m "feat(vendors): 추가/수정/상태전환 폼 모달(vendor-form.tsx)"
```

---

## Task 7: 목록 컴포넌트 2종

**Files:**
- Create: `src/features/vendors/components/vendor-contract-panel.tsx`
- Create: `src/features/vendors/components/vendor-candidate-row.tsx`

- [ ] **Step 1: 계약 패널**

Create `src/features/vendors/components/vendor-contract-panel.tsx`:
```tsx
import { Pressable, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { Vendor } from '@/types/db';
import { ROLE_LABEL } from '../api';

// 계약 확정 업체 패널(목업 `.signed`) — 역할 칩(SDM만)+이름+위치/계약일+계약 견적(참고값)+
// "비용에서 보기"(연결 지출 있을 때만). 카드 탭 = 수정 모달, "비용에서 보기" 탭 = 비용 이동(분리).
export function VendorContractPanel({
  vendor, linkedExpenseId, onPress, onViewExpense,
}: {
  vendor: Vendor;
  linkedExpenseId: string | null;
  onPress: () => void;
  onViewExpense: (expenseId: string) => void;
}) {
  const metaParts = [
    vendor.location,
    vendor.contract_date ? `계약일 ${vendor.contract_date}` : null,
  ].filter((p): p is string => !!p);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vendor.name} 수정`}
      style={{
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong,
        borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
            {vendor.role ? <Chip variant="ghost" label={ROLE_LABEL[vendor.role]} /> : null}
            <Text variant="titleSm" style={{ flexShrink: 1 }}>{vendor.name}</Text>
            <Chip variant="plan" label="계약" />
          </View>
          {metaParts.length > 0 ? (
            <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>
              {metaParts.join(' · ')}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="titleSm" tabularNums>
            {vendor.quoted_price != null ? formatMan(vendor.quoted_price) : '—'}
          </Text>
          <Text variant="caption" color="inkMuted">계약 견적</Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line,
        }}
      >
        <Text variant="caption" color="inkMuted">옵션·납부 내역은 비용에서 관리</Text>
        {linkedExpenseId ? (
          <Pressable
            onPress={() => onViewExpense(linkedExpenseId)}
            accessibilityRole="button"
            accessibilityLabel="비용에서 보기"
            hitSlop={8}
          >
            <Text variant="caption" color="blushInk">비용에서 보기 ›</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: 후보 행**

Create `src/features/vendors/components/vendor-candidate-row.tsx`:
```tsx
import { Chip, ListRow, Text } from '@/components/ui';
import { formatMan } from '@/lib/money';
import type { Vendor } from '@/types/db';
import { ROLE_LABEL } from '../api';

// 후보(검토 중) 리스트 행(목업 `.list .quote`) — ListRow 재사용. 탭하면 수정 모달(계약 확정 버튼 포함).
export function VendorCandidateRow({ vendor, onPress }: { vendor: Vendor; onPress: () => void }) {
  return (
    <ListRow
      title={vendor.name}
      subtitle={vendor.location ?? undefined}
      left={<Chip variant="ghost" label={vendor.role ? ROLE_LABEL[vendor.role] : '후보'} />}
      right={
        vendor.quoted_price != null ? (
          <Text variant="titleSm" tabularNums>{formatMan(vendor.quoted_price)}</Text>
        ) : undefined
      }
      onPress={onPress}
    />
  );
}
```

- [ ] **Step 3: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 4: 커밋**

```bash
git add src/features/vendors/components/vendor-contract-panel.tsx src/features/vendors/components/vendor-candidate-row.tsx
git commit -m "feat(vendors): 계약 패널·후보 행 컴포넌트"
```

---

## Task 8: 배럴 — `src/features/vendors/index.ts`

**Files:**
- Create: `src/features/vendors/index.ts`

- [ ] **Step 1: 구현**

Create `src/features/vendors/index.ts`:
```ts
// vendors 도메인 공개 API(배럴).
export { useVendors, useVendorsByArea, useCreateVendor, useUpdateVendor, useDeleteVendor } from './hooks';
export { selectVendors, selectVendorsByArea, findLinkedExpense, ROLE_LABEL, STATUS_LABEL } from './api';
export type { CreateVendorInput, UpdateVendorInput } from './api';
export type { AreaVendorGroup } from './types';
export { VendorForm, type VendorFormValue } from './components/vendor-form';
export { VendorContractPanel } from './components/vendor-contract-panel';
export { VendorCandidateRow } from './components/vendor-candidate-row';
```

- [ ] **Step 2: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 3: 커밋**

```bash
git add src/features/vendors/index.ts
git commit -m "feat(vendors): 배럴(index.ts)"
```

---

## Task 9: 화면 조립 — `src/app/vendors.tsx`

**Files:**
- Modify: `src/app/vendors.tsx`

- [ ] **Step 1: `PlaceholderScreen` 교체**

Replace `src/app/vendors.tsx` 전체:
```tsx
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useCouple, useCoupleSnapshot } from '@/features/couple';
import { AreaFilter } from '@/features/checklist/components/area-filter';
import {
  findLinkedExpense, useCreateVendor, useDeleteVendor, useUpdateVendor, useVendorsByArea,
  VendorCandidateRow, VendorContractPanel, VendorForm,
} from '@/features/vendors';
import type { VendorFormValue } from '@/features/vendors';
import { useAreas } from '@/hooks/use-areas';
import type { Vendor } from '@/types/db';

// 네이티브 스택 헤더가 이미 "← 업체 관리" 제목+뒤로가기를 제공한다(_layout.tsx의 headerShown:true).
// PageHead를 중복으로 쓰지 않는다(하객 화면과 동일 패턴).
export default function VendorsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: couple } = useCouple();
  const { data: areas = [] } = useAreas();
  const { data: snapshot } = useCoupleSnapshot();
  const { data: groups = [] } = useVendorsByArea(areas);

  const create = useCreateVendor();
  const update = useUpdateVendor();
  const remove = useDeleteVendor();

  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Vendor | null>(null);

  const visibleGroups = areaFilter === null ? groups : groups.filter((g) => g.area.id === areaFilter);
  const hasAny = groups.some((g) => g.contracted.length > 0 || g.candidates.length > 0);

  const openAdd = () => { setEditing(null); setFormKey((k) => k + 1); setFormOpen(true); };
  const openEdit = (v: Vendor) => { setEditing(v); setFormKey((k) => k + 1); setFormOpen(true); };
  const closeForm = () => setFormOpen(false);

  const submitForm = (v: VendorFormValue) => {
    if (editing) {
      // areaId는 생성 시 고정(체크리스트 관례) — UpdateVendorInput에 없는 필드라 명시적으로 뺀다.
      update.mutate({
        id: editing.id, name: v.name, status: v.status, role: v.role,
        location: v.location, contractDate: v.contractDate, quotedPrice: v.quotedPrice, memo: v.memo,
      });
    } else {
      create.mutate(v);
    }
    closeForm();
  };
  const deleteCurrent = () => {
    if (editing) remove.mutate({ id: editing.id });
    closeForm();
  };
  const goToExpense = (expenseId: string) => {
    router.push({ pathname: '/budget', params: { expenseId } });
  };

  const sub = couple
    ? `${couple.groom_name} & ${couple.bride_name}${couple.wedding_date ? ` · ${couple.wedding_date}` : ''}`
    : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: 100 + insets.bottom }}>
        {sub ? <Text variant="meta" color="inkMuted">{sub}</Text> : null}

        <View style={{ marginTop: spacing.lg }}>
          <AreaFilter areas={areas} selected={areaFilter} onSelect={setAreaFilter} />
        </View>

        {!hasAny ? (
          <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
            <Text variant="body" color="inkMuted">아직 등록된 업체가 없습니다.</Text>
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
              아래 &lsquo;업체 추가&rsquo;로 시작하세요.
            </Text>
          </View>
        ) : (
          visibleGroups.map((g) => {
            if (g.contracted.length === 0 && g.candidates.length === 0) return null;
            return (
              <View key={g.area.id} style={{ marginTop: spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Text variant="titleSm">{g.area.name_ko}</Text>
                  <Text variant="caption" color="inkMuted">
                    {g.contracted.length > 0 ? `계약 ${g.contracted.length}` : '미계약'}
                    {g.candidates.length > 0 ? ` · 후보 ${g.candidates.length}곳` : ''}
                  </Text>
                </View>

                {g.contracted.map((v) => (
                  <VendorContractPanel
                    key={v.id}
                    vendor={v}
                    linkedExpenseId={snapshot ? findLinkedExpense(snapshot, v.id)?.id ?? null : null}
                    onPress={() => openEdit(v)}
                    onViewExpense={goToExpense}
                  />
                ))}

                {g.candidates.length > 0 ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Text variant="caption" color="inkMuted">검토했던 후보</Text>
                    {g.candidates.map((v) => (
                      <VendorCandidateRow key={v.id} vendor={v} onPress={() => openEdit(v)} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Fab label="업체 추가" onPress={openAdd} bottomInset={insets.bottom} />

      <VendorForm
        key={formKey}
        visible={formOpen}
        areas={areas}
        editing={editing}
        defaultAreaId={areaFilter}
        onSubmit={submitForm}
        onDelete={editing ? deleteCurrent : undefined}
        onClose={closeForm}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: tsc·lint 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 에러 · 0 lint 경고

- [ ] **Step 3: 커밋**

```bash
git add src/app/vendors.tsx
git commit -m "feat(vendors): 업체 화면 실구현 — 영역 필터+계약 패널+후보 리스트+폼"
```

---

## Task 10: 비용 연동 — `src/app/(tabs)/budget.tsx` 보강

**Files:**
- Modify: `src/app/(tabs)/budget.tsx`

- [ ] **Step 1: import 수정**

1번째 줄을 교체:
```tsx
import { useEffect, useMemo, useState } from 'react';
```
`expo-router`에서 `useLocalSearchParams` 추가(파일 상단, 기존 import들 사이):
```tsx
import { useLocalSearchParams } from 'expo-router';
```

- [ ] **Step 2: `expenseId` 파라미터로 상세 모달 자동 오픈**

`const [detailId, setDetailId] = useState<string | null>(null);` 줄 바로 아래에 추가:
```tsx
  // 업체 화면의 "비용에서 보기"가 ?expenseId=로 넘어오면 해당 지출 상세를 바로 연다.
  const { expenseId } = useLocalSearchParams<{ expenseId?: string }>();
  useEffect(() => {
    if (expenseId) setDetailId(expenseId);
  }, [expenseId]);
```

- [ ] **Step 3: tsc 확인**

Run: `npx tsc --noEmit`
Expected: 0 에러

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(tabs\)/budget.tsx
git commit -m "feat(budget): expenseId 파라미터로 지출 상세 모달 자동 오픈(업체 연동)"
```

---

## Task 11: 전체 검증 + 문서 갱신

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

사용자가 Task 1의 `0007_vendor_writes.sql`을 Supabase SQL Editor에서 실행했는지 확인한다. 아직
안 했다면 **여기서 멈추고 사용자에게 요청** — 이후 실기기/웹 CRUD 실측이 전부 이 단계에 의존한다.

- [ ] **Step 3: 실기기/웹 CRUD 경계 실측**(사용자 또는 웹 프리뷰)

다음을 순서대로 실행하고 결과를 기록한다:
1. 빈 상태에서 "업체 추가" → 후보 1건 생성(영역·이름만) → 목록에 "검토했던 후보"로 노출되는지.
2. 후보 행 탭 → 모달에서 계약일·계약 견적 입력 → "계약 확정" 탭 → 계약 패널로 이동했는지(후보
   목록에서 사라지고 계약 섹션에 나타나는지).
3. 계약 패널 탭 → 모달에서 "후보로 되돌리기" → 다시 후보 목록으로 돌아가는지.
4. 비용 화면에서 그 업체를 연결해 지출 1건 생성 → 업체 화면 계약 패널에 "비용에서 보기" 링크가
   나타나는지 → 탭해서 비용 탭으로 이동 + 해당 지출 상세 모달이 자동으로 열리는지.
5. 연결된 지출이 있는 업체를 삭제 시도 → 실패하고 `Alert`로 "연결된 지출이 있어 삭제할 수
   없습니다" 메시지가 뜨는지(낙관적으로 사라졌다가 되돌아오는지도 확인).
6. 연결 지출이 없는 업체(후보 또는 계약)를 삭제 → 정상 삭제.
7. 영역 필터 전체/개별 전환 시 해당 영역만 보이는지. 영역에 업체가 아예 없을 때 그 섹션이
   안 보이는지(접히는지 — "빈 상태" 플레이스홀더는 전체 업체 0건일 때만 뜬다).
8. SDM 영역에서만 "역할" 필드가 폼에 나타나는지, 다른 영역에서는 안 나타나는지.

- [ ] **Step 4: `docs/04-dev-plan.md` 체크박스 갱신**

`## Phase 2` 아래 "검증 체크리스트 — 업체·갤러리" 섹션의 업체 관련 줄을 갱신(갤러리는 별개라
그대로 둔다):
```markdown
**검증 체크리스트 — 업체**
- [x] `npx tsc --noEmit` 0에러
- [x] 업체 CRUD + 필터/그룹 동작(실측) — 후보/계약 전환·"비용에서 보기" 연동·연결 지출 있는
      업체 삭제 거부 포함

**검증 체크리스트 — 갤러리**
- [ ] 사진 업로드→Storage 저장→썸네일 표시, 영역 분류 동작(실측)
```

- [ ] **Step 5: `.claude/CLAUDE.md` 「현재 상태」 갱신**

"업체 관리" 화면별 핵심 구조 줄을 교체:
```markdown
- **업체 관리** — **실구현 완료·실기기 검증**(`app/vendors.tsx`+`features/vendors/`). **정보 관리
  전용**(ADR-0001 — 금액 소스 아님). 영역 필터+계약 패널(여러 개 가능)+후보 리스트+폼 모달(후보↔계약
  전환은 모달의 명시적 버튼)+"비용에서 보기"(연결 지출로 비용 탭 이동+상세 모달 자동 오픈). 삭제는
  연결 지출이 있으면 DB가 거부(PT409)하고 `Alert`로 사유를 보여준다.
```
「진행 현황」 표의 Phase 3(개발) 요약 줄도 갱신:
```markdown
| 3 — 개발 | Phase 0·Phase 1(홈·일정·체크·비용) 완료. Phase 2 중 하객·업체 관리 완료(갤러리 남음) | 🟡 Realtime 검증 보류, 하객 엑셀 실기기 플로우 미검증 ([phase-1 보고서](../docs/reports/phase-1.md), Phase 2는 `04` 참고) |
```

- [ ] **Step 6: `.claude/HANDOFF.md` 갱신**

§0 한 줄 현황·§2(다음 작업)·§4(열린 질문)를 업체 완료·갤러리 착수로 갱신(지난 세션 기록을
덧붙이지 않고 그 자리에서 고쳐 쓴다 — HANDOFF.md 자체 규칙).

- [ ] **Step 7: 최종 커밋**

```bash
git add docs/04-dev-plan.md .claude/CLAUDE.md .claude/HANDOFF.md
git commit -m "docs: 업체(vendors) 슬라이스 완료 반영 — 04 체크박스·CLAUDE.md·HANDOFF.md"
```

---

## 하지 않는 것 (스펙과 동일, 재확인)

- 금액 상세(옵션·납부) 관리 — 비용 화면 소관(ADR-0001).
- 후보별 세부 속성(보증인원·식대 등) 전용 필드 — `memo` 자유 텍스트로 대체.
- 갤러리 — 별도 슬라이스.
- Realtime 두 기기 교차 반영 검증 — 기존 보류 항목에 업체만 추가, 새로 확인하지 않음.

# 체크리스트 슬라이스 구현 계획 (Phase 1 첫 슬라이스)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 체크리스트 화면을 실데이터 CRUD로 동작시키고, 그 과정에서 쓰기 RPC·낙관적 스냅샷 캐시 패치·jest-expo 단위 테스트 패턴을 확립한다(일정·비용·홈이 재사용).

**Architecture:** 커플 데이터는 RPC 게이트웨이로만 접근(ADR-0003). 읽기는 단일 스냅샷 위 셀렉터, 쓰기는 `p_share_code`로 서버가 couple_id를 해소하는 security-definer RPC. 쓰기 시 TanStack `useMutation`이 `['snapshot', code]` 캐시를 순수 리듀서(`cache.ts`)로 낙관적 패치하고 실패 시 롤백, Realtime Broadcast가 재조회로 수렴.

**Tech Stack:** Expo SDK 58 / React Native 0.88 / Expo Router / TanStack Query v5 / Supabase(Postgres RPC) / jest-expo.

**설계 스펙:** `docs/superpowers/specs/2026-11-06-phase1-checklist-slice-design.md`

---

## 파일 구조 (생성/수정)

| 파일 | 책임 | 작업 |
|---|---|---|
| `package.json` · `jest.config.js` | jest-expo 테스트 러너 | 수정/생성 |
| `src/features/checklist/types.ts` | 뷰 타입(`ChecklistSection`) | 수정 |
| `src/features/checklist/api.ts` | 셀렉터(정렬·영역 그룹·진행률) + 쓰기 함수(lib/rpc 위임) | 수정 |
| `src/features/checklist/cache.ts` | 스냅샷 낙관적 패치 **순수 리듀서** | 생성 |
| `src/features/checklist/cache.test.ts` · `api.test.ts` | 단위 테스트 | 생성 |
| `src/features/checklist/hooks.ts` | 읽기 훅(기존) + mutation 훅(낙관적) | 수정 |
| `src/features/checklist/components/*` | 화면 전용 UI | 생성 |
| `src/features/checklist/index.ts` | 배럴 | 수정 |
| `supabase/migrations/0002_checklist_writes.sql` | 쓰기 RPC 4종 | 생성 |
| `src/lib/rpc.ts` | RPC 래퍼 4종 추가 | 수정 |
| `src/lib/reference.ts` | 전역 참조 직접 조회(`getAreas`) | 생성 |
| `src/hooks/use-areas.ts` | `area` 참조 쿼리 훅 | 생성 |
| `src/app/(tabs)/checklist.tsx` | 화면 조립 | 수정 |

**areas 참조가 필요한 이유:** `checklist_item.area_id`는 uuid FK이고 스냅샷엔 `area` 테이블이 없다(전역 참조). 영역 섹션 헤더·추가 폼의 영역 선택에 area(id→name_ko)가 필요하므로 `area`를 직접 조회한다(공개 읽기 정책, ADR-0003 허용).

---

## Task 1: jest-expo 테스트 러너 도입

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `src/features/checklist/smoke.test.ts` (러너 확인용, Task 2 후 삭제)

- [ ] **Step 1: jest-expo 설치**

Run:
```bash
npx expo install -- --save-dev jest-expo jest
```
Expected: `jest-expo`, `jest`가 devDependencies에 추가됨.

- [ ] **Step 2: jest 설정 생성**

Create `jest.config.js`:
```js
// 순수 로직 단위 테스트용. jest-expo preset이 babel-preset-expo로 TS/JSX를 변환한다.
// 타입 검사는 tsc가 따로 한다(여기선 런타임 동작만).
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};
```

- [ ] **Step 3: test 스크립트 추가**

Modify `package.json` scripts에 추가:
```json
    "test": "jest",
```

- [ ] **Step 4: 러너 스모크 테스트**

Create `src/features/checklist/smoke.test.ts`:
```ts
test('jest 러너 동작', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 5: 실행 확인**

Run: `npm test`
Expected: PASS (1 test). jest-expo가 정상 구동됨.

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json jest.config.js src/features/checklist/smoke.test.ts
git commit -m "chore(test): jest-expo 테스트 러너 도입"
```

---

## Task 2: 체크리스트 순수 로직 (셀렉터·진행률·캐시 리듀서) — TDD

**Files:**
- Modify: `src/features/checklist/types.ts`
- Modify: `src/features/checklist/api.ts`
- Create: `src/features/checklist/cache.ts`
- Create: `src/features/checklist/api.test.ts`
- Create: `src/features/checklist/cache.test.ts`
- Delete: `src/features/checklist/smoke.test.ts`

- [ ] **Step 1: 뷰 타입 갱신**

Replace `src/features/checklist/types.ts` 전체:
```ts
import type { Area, ChecklistItem } from '@/types/db';

// 뷰/파생 타입. 체크리스트 화면은 영역별 섹션으로 묶어 보여준다(미니 미터 요약 포함).
export type ChecklistSection = {
  area: Area;
  items: ChecklistItem[];
  doneCount: number;
  totalCount: number;
  percent: number; // 0~100 정수
};
```

- [ ] **Step 2: 셀렉터 테스트 작성(실패 유도)**

Create `src/features/checklist/api.test.ts`:
```ts
import type { Area, ChecklistItem } from '@/types/db';
import { groupByArea, overallPercent, selectChecklist } from './api';

const area = (id: string, order: number, name: string): Area => ({
  id, created_at: '', code: 'SDM', name_ko: name, sort_order: order,
});
const item = (id: string, areaId: string, done: boolean, sort = 0): ChecklistItem => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, title: id, assignee: 'BOTH',
  is_done: done, done_at: done ? '2026-01-01T00:00:00Z' : null, due_date: null, memo: null,
  origin: 'USER', sort_order: sort,
});

const areas: Area[] = [area('a2', 2, '웨딩홀'), area('a1', 1, '스드메')];

describe('selectChecklist', () => {
  test('sort_order 오름차순 정렬, 원본 불변', () => {
    const snap: any = { checklist_items: [item('x', 'a1', false, 2), item('y', 'a1', false, 1)] };
    const out = selectChecklist(snap);
    expect(out.map((i) => i.id)).toEqual(['y', 'x']);
    expect(snap.checklist_items.map((i: ChecklistItem) => i.id)).toEqual(['x', 'y']); // 원본 보존
  });
});

describe('groupByArea', () => {
  test('area sort_order 순으로 그룹, done/total/percent 계산', () => {
    const items = [item('i1', 'a1', true), item('i2', 'a1', false), item('i3', 'a2', true)];
    const out = groupByArea(items, areas);
    expect(out.map((s) => s.area.id)).toEqual(['a1', 'a2']); // 정렬
    expect(out[0]).toMatchObject({ doneCount: 1, totalCount: 2, percent: 50 });
    expect(out[1]).toMatchObject({ doneCount: 1, totalCount: 1, percent: 100 });
  });
  test('항목 없는 영역은 0/0·0%', () => {
    const out = groupByArea([], areas);
    expect(out.every((s) => s.totalCount === 0 && s.percent === 0)).toBe(true);
  });
});

describe('overallPercent', () => {
  test('완료 비율 반올림', () => {
    expect(overallPercent([item('a', 'a1', true), item('b', 'a1', false), item('c', 'a1', false)])).toBe(33);
  });
  test('빈 목록은 0', () => {
    expect(overallPercent([])).toBe(0);
  });
});
```

- [ ] **Step 3: 실행해 실패 확인**

Run: `npm test -- api.test`
Expected: FAIL — `groupByArea`/`overallPercent` not exported.

- [ ] **Step 4: 셀렉터 구현**

Replace `src/features/checklist/api.ts` 전체:
```ts
import type { Area, Assignee, ChecklistItem, CoupleSnapshot } from '@/types/db';
import type { ChecklistSection } from './types';
import * as rpc from '@/lib/rpc';

// 코어(순수) — RN/expo UI를 import하지 않는다. 셀렉터 + 쓰기 함수(lib/rpc 위임).

// 읽기: 스냅샷에서 체크리스트 슬라이스. sort_order 안정 정렬(원본 불변).
export function selectChecklist(snapshot: CoupleSnapshot): ChecklistItem[] {
  return [...snapshot.checklist_items].sort((a, b) => a.sort_order - b.sort_order);
}

// 읽기: 영역별로 묶고 진행률을 계산한다(항목 없는 영역도 0/0으로 포함). area sort_order 순.
export function groupByArea(items: ChecklistItem[], areas: Area[]): ChecklistSection[] {
  return [...areas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => {
      const areaItems = items.filter((i) => i.area_id === area.id);
      const doneCount = areaItems.filter((i) => i.is_done).length;
      const totalCount = areaItems.length;
      const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
      return { area, items: areaItems, doneCount, totalCount, percent };
    });
}

// 읽기: 전체 완료 비율(0~100 반올림).
export function overallPercent(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.is_done).length / items.length) * 100);
}

// 쓰기: lib/rpc 위임(ADR-0003 — supabase.rpc는 lib/rpc에만). shareCode는 호출 훅이 주입.
export type CreateChecklistItemInput = {
  areaId: string;
  title: string;
  assignee: Assignee;
  dueDate?: string | null;
  memo?: string | null;
};
export type UpdateChecklistItemInput = {
  id: string;
  title: string;
  assignee: Assignee;
  dueDate?: string | null;
  memo?: string | null;
};

export function createChecklistItem(shareCode: string, input: CreateChecklistItemInput) {
  return rpc.createChecklistItem(shareCode, input);
}
export function updateChecklistItem(shareCode: string, input: UpdateChecklistItemInput) {
  return rpc.updateChecklistItem(shareCode, input);
}
export function toggleChecklistItem(shareCode: string, id: string, isDone: boolean) {
  return rpc.toggleChecklistItem(shareCode, id, isDone);
}
export function deleteChecklistItem(shareCode: string, id: string) {
  return rpc.deleteChecklistItem(shareCode, id);
}
```

> 주의: 이 시점에 `@/lib/rpc`에 쓰기 래퍼가 아직 없어 타입 에러가 난다 — Task 3에서 추가한다. `npm test -- api.test`는 babel 변환이라 통과하지만 `tsc`는 Task 3 후 통과한다. 셀렉터 테스트만 먼저 녹색으로 만든다.

- [ ] **Step 5: 셀렉터 테스트 통과 확인**

Run: `npm test -- api.test`
Expected: PASS (셀렉터 4케이스).

- [ ] **Step 6: 캐시 리듀서 테스트 작성(실패 유도)**

Create `src/features/checklist/cache.test.ts`:
```ts
import type { ChecklistItem, CoupleSnapshot } from '@/types/db';
import { applyCreate, applyDelete, applyToggle, applyUpdate } from './cache';

const item = (id: string, done = false, sort = 0): ChecklistItem => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', title: id, assignee: 'BOTH',
  is_done: done, done_at: done ? '2026-01-01T00:00:00Z' : null, due_date: null, memo: null,
  origin: 'USER', sort_order: sort,
});
const snap = (items: ChecklistItem[]): CoupleSnapshot =>
  ({ checklist_items: items } as CoupleSnapshot);

describe('applyToggle', () => {
  test('is_done·done_at 쌍을 맞춘다', () => {
    const out = applyToggle(snap([item('a', false)]), 'a', true);
    expect(out.checklist_items[0].is_done).toBe(true);
    expect(out.checklist_items[0].done_at).not.toBeNull();
  });
  test('멱등성: 두 번 토글하면 상태 원복', () => {
    const s0 = snap([item('a', false)]);
    const s1 = applyToggle(s0, 'a', true);
    const s2 = applyToggle(s1, 'a', false);
    expect(s2.checklist_items[0].is_done).toBe(false);
    expect(s2.checklist_items[0].done_at).toBeNull();
  });
  test('보존성: 대상 외 항목·개수 불변, 원본 불변', () => {
    const s0 = snap([item('a'), item('b')]);
    const out = applyToggle(s0, 'a', true);
    expect(out.checklist_items).toHaveLength(2);
    expect(out.checklist_items[1]).toEqual(item('b'));
    expect(s0.checklist_items[0].is_done).toBe(false); // 원본 보존
  });
  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([item('a')]);
    expect(applyToggle(s0, 'zzz', true).checklist_items).toEqual(s0.checklist_items);
  });
});

describe('applyCreate', () => {
  test('추가 후 sort_order 정렬', () => {
    const out = applyCreate(snap([item('a', false, 1)]), item('b', false, 0));
    expect(out.checklist_items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('applyUpdate', () => {
  test('지정 필드만 변경, 나머지 보존', () => {
    const out = applyUpdate(snap([item('a')]), { id: 'a', title: '새 제목', assignee: 'ME' });
    expect(out.checklist_items[0]).toMatchObject({ title: '새 제목', assignee: 'ME', area_id: 'a1' });
  });
  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([item('a')]);
    expect(applyUpdate(s0, { id: 'zzz', title: 'x', assignee: 'ME' }).checklist_items).toEqual(s0.checklist_items);
  });
});

describe('applyDelete', () => {
  test('해당 id 제거, 나머지 보존', () => {
    const out = applyDelete(snap([item('a'), item('b')]), 'a');
    expect(out.checklist_items.map((i) => i.id)).toEqual(['b']);
  });
  test('병리: 없는 id는 개수 불변', () => {
    expect(applyDelete(snap([item('a')]), 'zzz').checklist_items).toHaveLength(1);
  });
});
```

- [ ] **Step 7: 실행해 실패 확인**

Run: `npm test -- cache.test`
Expected: FAIL — `./cache` 모듈 없음.

- [ ] **Step 8: 캐시 리듀서 구현**

Create `src/features/checklist/cache.ts`:
```ts
import type { ChecklistItem, CoupleSnapshot } from '@/types/db';
import type { UpdateChecklistItemInput } from './api';

// 스냅샷 캐시 낙관적 패치(순수·불변). CoupleSnapshot을 받아 새 스냅샷을 반환한다.
// 각 함수는 checklist_items 배열만 교체하고 나머지 슬라이스는 그대로 둔다.

function withItems(s: CoupleSnapshot, items: ChecklistItem[]): CoupleSnapshot {
  return { ...s, checklist_items: items };
}

export function applyCreate(s: CoupleSnapshot, item: ChecklistItem): CoupleSnapshot {
  return withItems(s, [...s.checklist_items, item].sort((a, b) => a.sort_order - b.sort_order));
}

export function applyToggle(s: CoupleSnapshot, id: string, isDone: boolean): CoupleSnapshot {
  return withItems(
    s,
    s.checklist_items.map((i) =>
      i.id === id ? { ...i, is_done: isDone, done_at: isDone ? new Date().toISOString() : null } : i,
    ),
  );
}

export function applyUpdate(s: CoupleSnapshot, patch: UpdateChecklistItemInput): CoupleSnapshot {
  return withItems(
    s,
    s.checklist_items.map((i) =>
      i.id === patch.id
        ? { ...i, title: patch.title, assignee: patch.assignee, due_date: patch.dueDate ?? null, memo: patch.memo ?? null }
        : i,
    ),
  );
}

export function applyDelete(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return withItems(s, s.checklist_items.filter((i) => i.id !== id));
}
```

- [ ] **Step 9: 캐시 테스트 통과 + 스모크 삭제**

Run: `npm test -- cache.test`
Expected: PASS (리듀서 전 케이스).
그다음 `git rm src/features/checklist/smoke.test.ts`.

- [ ] **Step 10: 커밋**

```bash
git add src/features/checklist/types.ts src/features/checklist/api.ts src/features/checklist/cache.ts src/features/checklist/api.test.ts src/features/checklist/cache.test.ts
git rm src/features/checklist/smoke.test.ts
git commit -m "feat(checklist): 순수 로직 — 셀렉터·진행률·낙관적 캐시 리듀서 + 단위 테스트"
```

---

## Task 3: 쓰기 RPC 마이그레이션 + lib/rpc 래퍼

**Files:**
- Create: `supabase/migrations/0002_checklist_writes.sql`
- Modify: `src/lib/rpc.ts`

- [ ] **Step 1: 마이그레이션 SQL 작성**

Create `supabase/migrations/0002_checklist_writes.sql`:
```sql
-- Phase 1 체크리스트 쓰기 RPC (ADR-0003). 커플 테이블은 RLS 정책이 없어 security-definer로만 접근.
-- 클라이언트는 couple_id를 모르므로 p_share_code로 서버가 해소한다(가진 코드의 커플만 쓰기 가능).
-- Broadcast 트리거·get_couple_snapshot은 이미 checklist_item을 포함(0001) → 여기선 쓰기 RPC만 추가.

create or replace function public.create_checklist_item(
  p_share_code text, p_area_id uuid, p_title text, p_assignee assignee,
  p_due_date date, p_memo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_sort int; v_row checklist_item%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  select coalesce(max(sort_order), 0) + 1 into v_sort
    from checklist_item where couple_id = v_couple and area_id = p_area_id;
  insert into checklist_item (couple_id, area_id, title, assignee, due_date, memo, sort_order)
    values (v_couple, p_area_id, p_title, p_assignee, p_due_date, p_memo, v_sort)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.update_checklist_item(
  p_share_code text, p_id uuid, p_title text, p_assignee assignee,
  p_due_date date, p_memo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row checklist_item%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update checklist_item set title = p_title, assignee = p_assignee, due_date = p_due_date, memo = p_memo
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'item not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function public.toggle_checklist_item(
  p_share_code text, p_id uuid, p_is_done boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row checklist_item%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update checklist_item
    set is_done = p_is_done, done_at = case when p_is_done then now() else null end
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'item not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_checklist_item(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from checklist_item where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'item not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

grant execute on function public.create_checklist_item(text,uuid,text,assignee,date,text) to anon;
grant execute on function public.update_checklist_item(text,uuid,text,assignee,date,text) to anon;
grant execute on function public.toggle_checklist_item(text,uuid,boolean) to anon;
grant execute on function public.delete_checklist_item(text,uuid) to anon;
```

- [ ] **Step 2: Supabase에 적용**

Supabase 대시보드(프로젝트 `kozaxtwyfphslkyxpxhu`) → SQL Editor에 위 파일 내용을 붙여 실행(0001을 적용한 방식과 동일). DDL은 anon으로 못 돌리므로 대시보드/elevated 접근 필요.
Expected: `Success. No rows returned`. 함수 4개 생성.

> **체크포인트(사용자/실행자):** 대시보드 접근이 필요하면 멈추고 사용자에게 적용을 요청한다. 적용 전엔 Step 4 실측이 실패한다.

- [ ] **Step 3: lib/rpc 래퍼 추가**

Modify `src/lib/rpc.ts` — 파일 끝에 추가(상단 import에 `ChecklistItem`, `Assignee` 추가):
```ts
// import type 줄에 ChecklistItem, Assignee 추가:
//   import type { Assignee, ChecklistItem, CoupleSnapshot, WeddingDateStatus } from '@/types/db';
import type { CreateChecklistItemInput, UpdateChecklistItemInput } from '@/features/checklist/api';

// ── 체크리스트 쓰기 RPC (ADR-0003: supabase.rpc는 이 파일에만) ──
export async function createChecklistItem(
  shareCode: string, input: CreateChecklistItemInput,
): Promise<ChecklistItem> {
  const { data, error } = await supabase.rpc('create_checklist_item', {
    p_share_code: shareCode, p_area_id: input.areaId, p_title: input.title,
    p_assignee: input.assignee, p_due_date: input.dueDate ?? null, p_memo: input.memo ?? null,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ChecklistItem;
}

export async function updateChecklistItem(
  shareCode: string, input: UpdateChecklistItemInput,
): Promise<ChecklistItem> {
  const { data, error } = await supabase.rpc('update_checklist_item', {
    p_share_code: shareCode, p_id: input.id, p_title: input.title,
    p_assignee: input.assignee, p_due_date: input.dueDate ?? null, p_memo: input.memo ?? null,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ChecklistItem;
}

export async function toggleChecklistItem(
  shareCode: string, id: string, isDone: boolean,
): Promise<ChecklistItem> {
  const { data, error } = await supabase.rpc('toggle_checklist_item', {
    p_share_code: shareCode, p_id: id, p_is_done: isDone,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ChecklistItem;
}

export async function deleteChecklistItem(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_checklist_item', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}
```

> 순환 주의: `lib/rpc`가 `@/features/checklist/api`의 **타입만**(`import type`) 가져온다 — 타입 전용 import는 런타임 순환을 만들지 않는다. 입력 타입의 출처는 api.ts로 유지(중복 정의 금지).

- [ ] **Step 4: 타입체크 + RPC 격리 실측**

Run: `npx tsc --noEmit`
Expected: 0에러 (api.ts ↔ rpc.ts 타입 맞물림).

그다음 1회용 Node 스크립트(HANDOFF 3절 방식 — 루트에 ESM, `@supabase/supabase-js`로 `.env` 키 사용)로 실측:
- 테스트 커플 생성(`create_couple`) → 그 코드로 `create_checklist_item` 호출 → `get_couple_snapshot`에 항목이 보이는지, `toggle`→`done_at` 세팅, `delete`→사라짐.
- **틀린 share_code로 `create_checklist_item` 호출 시 PT401**(격리) 확인.
검증 후 스크립트와 테스트 커플은 삭제한다(임시 계측 제거 원칙).

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0002_checklist_writes.sql src/lib/rpc.ts
git commit -m "feat(checklist): 쓰기 RPC(0002) + lib/rpc 래퍼 — 공유코드 격리"
```

---

## Task 4: 전역 참조(area) 조회 — lib/reference + use-areas 훅

**Files:**
- Create: `src/lib/reference.ts`
- Create: `src/hooks/use-areas.ts`

- [ ] **Step 1: 직접 조회 함수**

Create `src/lib/reference.ts`:
```ts
import { supabase } from './supabase';
import type { Area } from '@/types/db';

// 전역 참조(ADR-0003: area·seed_*·auspicious_day만 직접 select 허용 — 공개 읽기 정책).
// 커플 데이터가 아니므로 RPC 게이트웨이를 거치지 않는다.
export async function getAreas(): Promise<Area[]> {
  const { data, error } = await supabase.from('area').select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []) as Area[];
}
```

- [ ] **Step 2: 참조 쿼리 훅**

Create `src/hooks/use-areas.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { getAreas } from '@/lib/reference';

// 전역 참조 area는 거의 안 바뀌므로 길게 캐시한다. 공유 코드와 무관(커플 데이터 아님).
export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: getAreas,
    staleTime: 1000 * 60 * 60, // 1h
  });
}
```

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 0에러.
```bash
git add src/lib/reference.ts src/hooks/use-areas.ts
git commit -m "feat(reference): area 전역 참조 직접 조회 + use-areas 훅"
```

---

## Task 5: mutation 훅 (낙관적 패치)

**Files:**
- Modify: `src/features/checklist/hooks.ts`
- Modify: `src/features/checklist/index.ts`

- [ ] **Step 1: mutation 훅 구현**

Replace `src/features/checklist/hooks.ts` 전체:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { ChecklistItem, CoupleSnapshot } from '@/types/db';
import * as api from './api';
import * as cache from './cache';

// 체크리스트 읽기. 공유 스냅샷 캐시 위에 select로 슬라이스를 얹는다(별도 조회 없음).
export function useChecklist() {
  return useCoupleSnapshot(api.selectChecklist);
}

// 낙관적 뮤테이션 공통 배선: onMutate에서 스냅샷 캐시를 순수 리듀서로 즉시 패치,
// onError 롤백(이전 스냅샷 복원), onSettled invalidate(Realtime도 같은 키를 무효화해 수렴).
function useChecklistMutation<TArgs>(
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
    onError: (_e, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCreateChecklistItem() {
  const { shareCode } = useShareCode();
  return useChecklistMutation<api.CreateChecklistItemInput>(
    (code, input) => api.createChecklistItem(code, input),
    (s, input) => {
      // 낙관적 임시 행(서버 응답 전). couple_id는 스냅샷에서, 정렬은 맨 뒤.
      const temp: ChecklistItem = {
        id: `optimistic-${Date.now()}`, created_at: new Date().toISOString(),
        couple_id: s.couple.id, area_id: input.areaId, title: input.title, assignee: input.assignee,
        is_done: false, done_at: null, due_date: input.dueDate ?? null, memo: input.memo ?? null,
        origin: 'USER', sort_order: Number.MAX_SAFE_INTEGER,
      };
      return cache.applyCreate(s, temp);
    },
  );
}

export function useUpdateChecklistItem() {
  return useChecklistMutation<api.UpdateChecklistItemInput>(
    (code, input) => api.updateChecklistItem(code, input),
    (s, input) => cache.applyUpdate(s, input),
  );
}

export function useToggleChecklistItem() {
  return useChecklistMutation<{ id: string; isDone: boolean }>(
    (code, { id, isDone }) => api.toggleChecklistItem(code, id, isDone),
    (s, { id, isDone }) => cache.applyToggle(s, id, isDone),
  );
}

export function useDeleteChecklistItem() {
  return useChecklistMutation<{ id: string }>(
    (code, { id }) => api.deleteChecklistItem(code, id),
    (s, { id }) => cache.applyDelete(s, id),
  );
}
```

- [ ] **Step 2: 배럴 갱신**

Replace `src/features/checklist/index.ts` 전체:
```ts
// checklist 도메인 공개 API(배럴).
export {
  useChecklist, useCreateChecklistItem, useUpdateChecklistItem,
  useToggleChecklistItem, useDeleteChecklistItem,
} from './hooks';
export { selectChecklist, groupByArea, overallPercent } from './api';
export type { CreateChecklistItemInput, UpdateChecklistItemInput } from './api';
export type { ChecklistSection } from './types';
```

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 0에러.
```bash
git add src/features/checklist/hooks.ts src/features/checklist/index.ts
git commit -m "feat(checklist): 낙관적 mutation 훅(추가·수정·토글·삭제)"
```

---

## Task 6: 화면 전용 UI 컴포넌트

**Files:**
- Create: `src/features/checklist/components/check-box.tsx`
- Create: `src/features/checklist/components/check-row.tsx`
- Create: `src/features/checklist/components/area-section.tsx`
- Create: `src/features/checklist/components/area-filter.tsx`
- Create: `src/features/checklist/components/checklist-form.tsx`

- [ ] **Step 1: 체크박스(히트 영역 ≥44px)**

Create `src/features/checklist/components/check-box.tsx`:
```tsx
import { Pressable, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

// DESIGN.md 체크박스 20×20(시각). 터치 타겟은 hitSlop로 ≥44px 확보(Phase 0 함정: 시각 크기 키우지 말 것).
export function CheckBox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{
        width: 20, height: 20, borderRadius: radius.sm,
        borderWidth: 1.5, borderColor: checked ? colors.sage : colors.lineStrong,
        backgroundColor: checked ? colors.sage : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {checked ? (
        <View style={{ width: 9, height: 5, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: colors.surface, transform: [{ rotate: '-45deg' }], marginTop: -2 }} />
      ) : null}
    </Pressable>
  );
}
```

- [ ] **Step 2: 체크 행**

Create `src/features/checklist/components/check-row.tsx`:
```tsx
import { Pressable, View } from 'react-native';
import { Chip, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { ChecklistItem } from '@/types/db';
import { CheckBox } from './check-box';

const ASSIGNEE_LABEL: Record<ChecklistItem['assignee'], string> = {
  ME: '나', PARTNER: '애인', BOTH: '공동',
};

// 체크리스트 한 행: 체크박스 + 제목(완료 시 취소선·톤다운) + 담당/날짜 sub + 메모 + 우측 예정 칩.
// 행 전체 탭 = 수정 열기, 체크박스 탭 = 토글(분리).
export function CheckRow({
  item, first, onToggle, onEdit,
}: { item: ChecklistItem; first: boolean; onToggle: () => void; onEdit: () => void }) {
  const sub = `담당 · ${ASSIGNEE_LABEL[item.assignee]}${item.due_date ? `  ·  ${item.due_date}` : ''}`;
  return (
    <Pressable
      onPress={onEdit}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingVertical: spacing.lg, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line,
      }}
    >
      <View style={{ paddingTop: 2 }}>
        <CheckBox checked={item.is_done} onPress={onToggle} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="body"
          color={item.is_done ? 'inkMuted' : 'ink'}
          style={item.is_done ? { textDecorationLine: 'line-through', textDecorationColor: colors.lineStrong } : undefined}
        >
          {item.title}
        </Text>
        <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>{sub}</Text>
        {item.memo ? (
          <Text variant="caption" color="inkMuted" style={{ marginTop: 6 }}>{item.memo}</Text>
        ) : null}
      </View>
      {!item.is_done ? <Chip variant="plan" label="예정" /> : null}
    </Pressable>
  );
}
```

- [ ] **Step 3: 영역 섹션**

Create `src/features/checklist/components/area-section.tsx`:
```tsx
import { View } from 'react-native';
import { Meter, Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import type { ChecklistSection } from '../types';
import type { ChecklistItem } from '@/types/db';
import { CheckRow } from './check-row';

// 영역 섹션: 헤더(영역명 + N% · done/total) + 얇은 미터 + 항목 리스트.
export function AreaSection({
  section, onToggle, onEdit,
}: {
  section: ChecklistSection;
  onToggle: (item: ChecklistItem) => void;
  onEdit: (item: ChecklistItem) => void;
}) {
  return (
    <View style={{ marginTop: spacing.xxxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="titleSm">{section.area.name_ko}</Text>
        <Text variant="caption" color="inkMuted" tabularNums>
          {section.percent}% · {section.doneCount}/{section.totalCount}
        </Text>
      </View>
      <Meter value={section.percent} style={{ height: 4, marginBottom: spacing.md }} />
      {section.items.map((item, idx) => (
        <CheckRow
          key={item.id}
          item={item}
          first={idx === 0}
          onToggle={() => onToggle(item)}
          onEdit={() => onEdit(item)}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 4: 영역 필터(가로 스크롤 칩)**

Create `src/features/checklist/components/area-filter.tsx`:
```tsx
import { Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import type { Area } from '@/types/db';

// 영역 필터 칩(가로 스크롤). null = 전체. 선택 칩은 blushSoft/blushInk(목업).
export function AreaFilter({
  areas, selected, onSelect,
}: { areas: Area[]; selected: string | null; onSelect: (areaId: string | null) => void }) {
  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={{
        paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.pill,
        borderWidth: 1, borderColor: active ? 'transparent' : colors.lineStrong,
        backgroundColor: active ? colors.blushSoft : 'transparent', marginRight: spacing.sm,
      }}
    >
      <Text variant="label" color={active ? 'blushInk' : 'inkMuted'}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.xs }}>
      {chip('all', '전체', selected === null, () => onSelect(null))}
      {areas.map((a) => chip(a.id, a.name_ko, selected === a.id, () => onSelect(a.id)))}
    </ScrollView>
  );
}
```

- [ ] **Step 5: 추가/수정 폼(모달)**

Create `src/features/checklist/components/checklist-form.tsx`:
```tsx
import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Button, Chip, Segmented, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area, Assignee, ChecklistItem } from '@/types/db';

export type ChecklistFormValue = {
  areaId: string; title: string; assignee: Assignee; dueDate: string | null; memo: string | null;
};

const ASSIGNEE_OPTS = [
  { value: 'ME', label: '나' }, { value: 'PARTNER', label: '애인' }, { value: 'BOTH', label: '공동' },
] as const;

// 추가/수정 공용 모달. editing이 있으면 수정 모드(영역 고정). 날짜는 YYYY-MM-DD 텍스트 입력
// (세부 UX는 사용자 방침대로 개발 중 개선 — 지금은 단순 텍스트).
export function ChecklistForm({
  visible, areas, editing, defaultAreaId, onSubmit, onDelete, onClose,
}: {
  visible: boolean;
  areas: Area[];
  editing: ChecklistItem | null;
  defaultAreaId: string | null;
  onSubmit: (v: ChecklistFormValue) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [areaId, setAreaId] = useState(editing?.area_id ?? defaultAreaId ?? areas[0]?.id ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [assignee, setAssignee] = useState<Assignee>(editing?.assignee ?? 'BOTH');
  const [dueDate, setDueDate] = useState(editing?.due_date ?? '');
  const [memo, setMemo] = useState(editing?.memo ?? '');

  const canSave = title.trim().length > 0 && areaId.length > 0;

  const submit = () => {
    onSubmit({
      areaId, title: title.trim(), assignee,
      dueDate: dueDate.trim() ? dueDate.trim() : null,
      memo: memo.trim() ? memo.trim() : null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ backgroundColor: colors.ground, padding: layout.screenPadding, gap: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <Text variant="title">{editing ? '할 일 수정' : '할 일 추가'}</Text>

        {!editing ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {areas.map((a) => (
              <Pressable key={a.id} onPress={() => setAreaId(a.id)}>
                <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextInput
          value={title} onChangeText={setTitle} placeholder="할 일" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <Segmented
          options={ASSIGNEE_OPTS.map((o) => ({ value: o.value, label: o.label }))}
          value={assignee}
          onChange={(v) => setAssignee(v as Assignee)}
        />
        <TextInput
          value={dueDate} onChangeText={setDueDate} placeholder="날짜 (YYYY-MM-DD, 선택)" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <TextInput
          value={memo} onChangeText={setMemo} placeholder="메모 (선택)" placeholderTextColor={colors.inkFaint}
          multiline style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]}
        />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {editing && onDelete ? <Button variant="ghost" label="삭제" onPress={onDelete} /> : null}
          <View style={{ flex: 1 }} />
          <Button variant="ghost" label="취소" onPress={onClose} />
          <Button label="저장" onPress={submit} disabled={!canSave} />
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;
```

> **의존 확인(실행자):** `Button`이 `variant`·`disabled` prop을 받는지 `src/components/ui/button.tsx`를 먼저 읽는다. `Segmented`의 실제 prop 이름(`options`/`value`/`onChange` + 옵션 형태 `SegmentedOption`)을 `src/components/ui/segmented.tsx`로 확인하고 **실제 시그니처에 맞춘다**(이 코드의 prop 이름이 다르면 거기에 맞게 수정). 다르면 이 파일을 실제 API로 교정한 뒤 진행.

- [ ] **Step 6: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 0에러(프리미티브 prop 교정 포함).
```bash
git add src/features/checklist/components
git commit -m "feat(checklist): 화면 전용 UI — 체크박스·행·영역섹션·필터·추가수정 폼"
```

---

## Task 7: 화면 조립 — checklist.tsx

**Files:**
- Modify: `src/app/(tabs)/checklist.tsx`

- [ ] **Step 1: 화면 구현**

Replace `src/app/(tabs)/checklist.tsx` 전체:
```tsx
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fab, Meter, PageHead, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useAreas } from '@/hooks/use-areas';
import {
  groupByArea, overallPercent, useChecklist,
  useCreateChecklistItem, useDeleteChecklistItem, useToggleChecklistItem, useUpdateChecklistItem,
} from '@/features/checklist';
import { AreaFilter } from '@/features/checklist/components/area-filter';
import { AreaSection } from '@/features/checklist/components/area-section';
import { ChecklistForm, type ChecklistFormValue } from '@/features/checklist/components/checklist-form';
import type { ChecklistItem } from '@/types/db';

export default function ChecklistScreen() {
  const { data: items = [] } = useChecklist();
  const { data: areas = [] } = useAreas();
  const create = useCreateChecklistItem();
  const update = useUpdateChecklistItem();
  const toggle = useToggleChecklistItem();
  const remove = useDeleteChecklistItem();

  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);

  const sections = useMemo(() => {
    const grouped = groupByArea(items, areas);
    return areaFilter ? grouped.filter((s) => s.area.id === areaFilter) : grouped;
  }, [items, areas, areaFilter]);
  const visibleSections = sections.filter((s) => s.totalCount > 0);
  const overall = overallPercent(items);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (item: ChecklistItem) => { setEditing(item); setFormOpen(true); };
  const closeForm = () => setFormOpen(false);

  const submitForm = (v: ChecklistFormValue) => {
    if (editing) {
      update.mutate({ id: editing.id, title: v.title, assignee: v.assignee, dueDate: v.dueDate, memo: v.memo });
    } else {
      create.mutate(v);
    }
    closeForm();
  };
  const deleteCurrent = () => {
    if (editing) remove.mutate({ id: editing.id });
    closeForm();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: layout.tabBarHeight + 80 }}>
        <PageHead title="체크리스트" sub="영역별 할 일" />

        {/* 전체 진행률 */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text variant="bodySm" color="inkMuted">전체 체크리스트 진행</Text>
            <Text variant="bodySm" tabularNums>{overall}%</Text>
          </View>
          <Meter value={overall} />
        </View>

        {/* 영역 필터 */}
        <View style={{ marginTop: spacing.xl }}>
          <AreaFilter areas={areas} selected={areaFilter} onSelect={setAreaFilter} />
        </View>

        {/* 영역별 섹션 or 빈 상태 */}
        {items.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
            <Text variant="body" color="inkMuted">아직 할 일이 없습니다.</Text>
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
              아래 &lsquo;할 일 추가&rsquo;로 시작하세요.
            </Text>
          </View>
        ) : (
          visibleSections.map((s) => (
            <AreaSection
              key={s.area.id}
              section={s}
              onToggle={(item) => toggle.mutate({ id: item.id, isDone: !item.is_done })}
              onEdit={openEdit}
            />
          ))
        )}
      </ScrollView>

      <Fab label="할 일 추가" onPress={openAdd} />

      <ChecklistForm
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

- [ ] **Step 2: 타입체크 + 린트**

Run: `npx tsc --noEmit` → 0에러. `npx eslint src/app/\(tabs\)/checklist.tsx src/features/checklist` → 0건.

- [ ] **Step 3: 커밋**

```bash
git add "src/app/(tabs)/checklist.tsx"
git commit -m "feat(checklist): 화면 조립 — 진행률·영역필터·섹션·CRUD 폼·FAB·빈 상태"
```

---

## Task 8: 검증 (실측) + 작업 보고

**Files:** 없음(검증) / Create: 없음(Phase 1 보고는 슬라이스 전부 끝난 뒤 작성)

- [ ] **Step 1: 정적 검증**

Run: `npx tsc --noEmit` → 0에러 · `npm test` → 전 테스트 통과 · `npx eslint src` → 0건 · `npx expo-doctor` → 20/20.

- [ ] **Step 2: 런타임 CRUD 경계 실측(웹/기기)**

`npx expo start --web`(또는 기기). 실제 공유 코드로 접속 후:
- 빈 목록에서 **첫 추가**(영역·담당·날짜·메모) → 즉시 반영(낙관적) → 새로고침 후에도 유지.
- 중간 항목 **완료 토글**(취소선) → 다시 토글 **원복**. **수정**(제목·담당·날짜·메모). 
- **삭제** → 목록에서 사라짐. 영역 필터 전환 시 해당 영역만 표시.
- **실패 롤백 1건**: 무효 입력/네트워크 차단 시 낙관적 반영이 롤백되는지.
확인 수단은 HANDOFF 3절(웹 프리뷰 DOM/ref 실측) 참고. 임시 계측 코드는 제거.

- [ ] **Step 3: Realtime 양방향 실측**

두 세션(웹 탭 + 기기, 또는 두 브라우저)에서 같은 코드 접속 → 한쪽에서 추가/토글 → 반대쪽에 Broadcast로 반영되는지.

- [ ] **Step 4: 함정 재확인(문서 반영)**

- `features/checklist/components/`가 처음 생겼으니 이후 도메인도 같은 위치 규약(features/README) 유지.
- `lib/rpc`가 `@/features/checklist/api`의 **타입만** import하는 점(순환 방지)을 `features/README` 또는 CLAUDE.md 「아키텍처」에 한 줄 기록(다음 도메인이 같은 패턴 재사용).

- [ ] **Step 5: 슬라이스 커밋 마무리**

검증에서 수정이 생기면 별도 커밋. 이 슬라이스로 Phase 1 전체가 끝난 게 아니므로 `phase-1.md` 보고서는 **아직 쓰지 않는다**(일정·비용·홈 슬라이스 완료 후).

---

## 자체 리뷰 메모

- **스펙 커버리지**: ① 쓰기 RPC(Task 3) ② lib/rpc 래퍼(Task 3) ③ api 쓰기+셀렉터(Task 2/5)·cache 리듀서(Task 2)·mutation 훅(Task 5)·컴포넌트(Task 6) ④ 화면(Task 7) ⑤ jest 테스트(Task 1/2) — 스펙 5항목 전부 태스크 있음.
- **타입 일관성**: `CreateChecklistItemInput`/`UpdateChecklistItemInput`는 api.ts가 단일 정의, rpc.ts·hooks.ts·cache.ts는 `import type`로 참조(중복 정의·드리프트 없음). mutation 인자 형태(`{id,isDone}`·`{id}`)가 훅↔화면 호출부와 일치.
- **프리미티브 의존**: Task 6 Step 5에 `Button`/`Segmented` 실제 시그니처 확인 지시를 명시(코드가 추정이므로 실제 API로 교정).
- **외부 전제**: Task 3 Step 2(대시보드 DDL 적용)는 elevated 접근 필요 → 막히면 사용자에게 요청(체크포인트 명시).

# Phase 1 첫 슬라이스 — 체크리스트 화면 (설계 스펙)

작성일: 2026-11-06 · 상태: 승인됨(사용자) · 범위: Phase 1의 첫 세로 슬라이스

## 왜 이 문서인가 (Context)

Phase 0(기반)이 완료되고 `src/features/` 도메인 구조가 섰다. Phase 1은 코어 화면 4개(홈·일정·체크·
비용) 실데이터 CRUD인데 단일 스펙으로는 크다. **화면별 세로 슬라이스(end-to-end)로 분해**해 첫
슬라이스를 완성하고, 그때 확립한 **쓰기 RPC·낙관적 뮤테이션·테스트 패턴을 나머지 슬라이스가 재사용**한다.

**첫 슬라이스 = 체크리스트**(사용자 결정). 가장 단순한 풀 CRUD라 패턴 확립에 적합하고, 일정·비용이
그 위에 얹힌다. 홈은 집계 뷰라 네 번째.

## 결정된 전제 (바뀌면 이 문서부터 고친다)

- **UI는 승인된 목업 이식**: `design/checklist.html`의 구조·수치·레이아웃을 RN으로 옮긴다(CSS 자체는
  재사용 안 함). 새 비주얼 월드 금지 — `DESIGN.md` 상속. 공용 프리미티브는 `@/components/ui` 재사용.
- **데이터는 수동 추가로 시작**: 한국 표준 시드(seed_checklist_item → couple 복사)는 **Phase 3**. 이
  슬라이스는 빈 상태에서 사용자가 FAB로 추가하는 흐름. **빈 상태 UI 포함**.
- **테스트는 jest-expo + 순수 로직 단위 테스트**: RPC 왕복은 실측(웹/기기)으로 검증, 회귀 자산은
  순수 함수(셀렉터·캐시 리듀서) 단위 테스트로 남긴다.
- **읽기 = 단일 스냅샷 셀렉터**(ADR-0003): 이미 `features/checklist`에 `selectChecklist`·`useChecklist`
  존재. 이 슬라이스는 **쓰기 + 화면**을 채운다.

## 아키텍처 (ADR·구조 제약 — 그대로 따른다)

- 커플 테이블은 RLS 정책 없이 **security-definer RPC로만 접근**. 클라이언트는 `couple_id`를 모른다 →
  **모든 쓰기 RPC는 `p_share_code`를 받아 서버가 couple_id를 해소**한다(격리: 가진 코드의 커플만 쓰기 가능).
- `lib/rpc`가 모든 `supabase.rpc()`의 유일 통로. `features/checklist/api.ts`는 lib/rpc를 호출(코어, RN 비의존).
- Broadcast 트리거(`trg_bc_checklist`)와 스냅샷 함수(`get_couple_snapshot`)는 이미 `checklist_item`을
  포함(0001). **이번은 테이블/컬럼 추가가 아니라 쓰기 RPC 추가뿐** → 3곳 동기화 중 트리거·스냅샷은 불변.

## 산출물

### ① 쓰기 RPC — `supabase/migrations/0002_checklist_writes.sql`

4개 함수. 공통: `language plpgsql · security definer · set search_path = public`, `p_share_code`로
couple을 찾아(없으면 `raise ... errcode 'PT401'`) couple_id 해소, 끝에 `grant execute ... to anon`.

| RPC | 인자 | 동작 |
|---|---|---|
| `create_checklist_item` | `p_share_code, p_area_id, p_title, p_assignee, p_due_date, p_memo` | insert 후 생성 행(jsonb) 반환. sort_order는 해당 영역 max+1 |
| `update_checklist_item` | `p_share_code, p_id, p_title, p_assignee, p_due_date, p_memo` | 해당 couple의 행만 update. 수정 행 반환 |
| `toggle_checklist_item` | `p_share_code, p_id, p_is_done` | `is_done` + `done_at`(true=now()/false=null) 쌍을 서버가 맞춤(`checklist_done_pair` 제약). 반환 행 |
| `delete_checklist_item` | `p_share_code, p_id` | 해당 couple의 행만 delete |

- 모든 쓰기는 `where couple_id = v.id and id = p_id`로 **남의 커플 행을 못 건드리게** 한정.
- 트리거가 자동으로 Broadcast 신호를 쏜다(추가 코드 없음).

### ② RPC 래퍼 — `src/lib/rpc.ts`

타입드 래퍼 4개 추가(기존 `createCouple`·`getCoupleSnapshot` 옆). 입력 타입은 `@/types/db`의 행 타입
기반. 예: `createChecklistItem(input): Promise<ChecklistItem>`. 무효 코드 처리는 기존 PT401 패턴 재사용.

### ③ 도메인 로직 — `src/features/checklist/`

- `api.ts`: TODO로 둔 쓰기 함수 구현(`createChecklistItem`/`updateChecklistItem`/`toggleChecklistItem`/
  `deleteChecklistItem` — lib/rpc 호출). 코어, RN 비의존 유지.
- **`cache.ts`(신규, 순수)**: 스냅샷 캐시 낙관적 패치 리듀서. `applyCreate(snapshot, item)`·
  `applyToggle(snapshot, id, isDone)`·`applyUpdate(snapshot, patch)`·`applyDelete(snapshot, id)` —
  `CoupleSnapshot`을 받아 **새 스냅샷**을 반환(불변 업데이트). 단위 테스트의 핵심 대상.
- `hooks.ts`: mutation 훅 추가(`useCreateChecklistItem` 등). 각 훅은 TanStack `useMutation` +
  `onMutate`에서 `queryClient.setQueryData(coupleKeys.snapshot(code), cache.apply*)`로 낙관적 패치,
  `onError` 롤백(이전 스냅샷 보관), `onSettled` invalidate. (Realtime도 같은 키를 무효화해 수렴.)
- `components/`(신규): 화면 전용 UI — 체크리스트 행(체크박스+취소선·날짜·메모·담당자 칩), 영역 섹션
  헤더+미니 미터, 추가/수정 입력 폼(모달 또는 시트), FAB. 공용 프리미티브 재사용.

### ④ 화면 — `src/app/(tabs)/checklist.tsx`

플레이스홀더를 실구현으로 교체. `useChecklist`로 읽고 mutation 훅으로 쓰기. 영역 필터(칩) 상태는
로컬, 영역별 그룹핑은 `features/checklist/types.ts`의 `ChecklistSection` 뷰 타입으로. 빈 상태·로딩
상태 처리. 터치 타겟 ≥24px(히트 영역, Phase 0 함정 참조).

### ⑤ 테스트 — jest-expo

- 도입: `jest-expo` preset + `jest` devDependency, `package.json`에 `"test": "jest"`, 최소 jest 설정.
- 단위 테스트(`features/checklist/*.test.ts`):
  - `selectChecklist`: sort_order 정렬, 원본 불변.
  - `cache.ts` 리듀서: 추가/토글/수정/삭제 각각 — **멱등성**(토글 두 번 = 원복), **보존성**(대상 외
    항목·개수·순서 불변), **병리 입력**(빈 목록, 존재하지 않는 id → 안전하게 무변경).

## 유닛 경계 (각각 독립 이해·테스트 가능)

| 유닛 | 하는 일 | 의존 |
|---|---|---|
| `0002_*.sql` RPC | couple 격리 하 체크리스트 쓰기 | couple/area 테이블·제약 |
| `lib/rpc` 래퍼 | RPC 호출을 타입드 함수로 | supabase·types/db |
| `features/checklist/cache.ts` | 스냅샷 불변 패치(순수) | types/db only |
| `features/checklist/api.ts` | 도메인 쓰기(코어) | lib/rpc |
| `features/checklist/hooks.ts` | Query/Mutation 배선 | couple/hooks·api·cache·keys |
| `features/checklist/components` | 화면 전용 UI | components/ui·hooks |
| `app/(tabs)/checklist.tsx` | 조립 | features/checklist |

## 하지 않는 것 (경계)

- 표준 시드 불러오기(Phase 3). 일정·비용·홈 화면(다음 슬라이스). 다른 도메인 쓰기 RPC.
- 커플 테이블/컬럼·스냅샷 함수·트리거 변경(이번은 쓰기 RPC만).
- Supabase 통합 테스트(RPC 왕복은 실측으로 갈음).

## 검증 (완료 판정)

- `npx tsc --noEmit` 0에러 · `npm test` 통과 · `npx eslint` 0건.
- 웹/기기에서 CRUD **경계 포함** 실측: 빈 목록에서 첫 추가 / 중간 항목 토글·수정 / 마지막 삭제.
- 두 세션(웹+기기 또는 두 탭)에서 한쪽 변경이 Realtime으로 반대쪽 반영 실측.
- 낙관적 반영 즉시성 + 실패 롤백 1건 실측(네트워크/무효 입력).

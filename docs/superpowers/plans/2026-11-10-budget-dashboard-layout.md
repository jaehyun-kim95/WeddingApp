# 비용 화면 대시보드/아코디언/필터 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비용 화면을 "흰 패널 대시보드 ↔ 지출 목록" 구분, 상단 지표(약정·납부·잔여), 지출 카드 아코디언, 영역 드롭다운 필터로 개선한다.

**Architecture:** 순수 셀렉터(`api.ts`)의 `BudgetSummary.remaining` 의미만 재정의하고(약정−납부, 0 클램프), 나머지는 전부 프레젠테이션 레이어(RN 컴포넌트) 변경이다. 영역 필터는 화면 로컬 `useState`로 클라이언트 필터링(스냅샷·RPC·캐시 무영향). 아코디언 열림 상태도 카드 로컬 상태라 저장하지 않는다.

**Tech Stack:** Expo/React Native, TypeScript(strict), Jest(jest-expo) — 셀렉터/리듀서만 유닛 테스트하는 프로젝트 관례를 따른다(RN 프레젠테이션 컴포넌트는 tsc+eslint+런타임 확인).

**설계 문서:** `docs/superpowers/specs/2026-11-10-budget-dashboard-layout-design.md`
**목업(승인됨):** `design/budget-dashboard-variants.html` (① C안 · ② 한 줄 요약 · ③ 진행 · ④ 1안)

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/features/budget/types.ts` | 뷰/파생 타입 | `BudgetSummary.remaining` 주석을 "약정−납부"로 갱신 |
| `src/features/budget/api.ts` | 순수 셀렉터 | `selectBudgetSummary`의 `remaining` 계산 변경 |
| `src/features/budget/api.test.ts` | 셀렉터 유닛 테스트 | `remaining` 관련 테스트 재작성 |
| `src/features/budget/components/budget-summary.tsx` | 상단 요약 3셀 + 캡션 | 셀을 약정\|납부\|잔여로 재배치 |
| `src/features/budget/components/vendor-group.tsx` | 지출 1건 카드 | 아코디언化(접힘=한 줄, 펼침=상세+"수정") |
| `src/features/budget/components/area-filter-dropdown.tsx` | 영역 다중선택 필터(신규) | 신규 생성 |
| `src/app/(tabs)/budget.tsx` | 화면 조립 | 대시보드 흰 카드 래핑 + 영역 필터 상태/렌더 |

---

### Task 1: `selectBudgetSummary`의 잔여를 "약정−납부"로 재정의

**Files:**
- Modify: `src/features/budget/api.ts:47`
- Modify: `src/features/budget/types.ts:19`
- Test: `src/features/budget/api.test.ts`

- [ ] **Step 1: 실패하는 테스트로 교체**

`src/features/budget/api.test.ts`의 `describe('selectBudgetSummary', …)` 블록 전체(현재 라인 32~77)를 아래로 교체한다. 핵심 변경: `remaining`을 `committed − actualSpent`(0 클램프)로 기대.

```ts
describe('selectBudgetSummary', () => {
  test('빈 스냅샷 → 전부 0', () => {
    const s = selectBudgetSummary(snap({}, 0));
    expect(s).toEqual({ totalBudget: 0, committed: 0, actualSpent: 0, remaining: 0, spentRate: 0, budgetRate: 0 });
  });

  // spentRate(메인 기준) = 실지출/약정. budgetRate(참고자료) = 약정/예산. 잔여 = 약정 − 납부(미납 총액).
  test('약정=기본+옵션 합, 실지출=납부완료만, 잔여=약정−납부', () => {
    const s = selectBudgetSummary(
      snap({
        expenses: [expense('e1', 'a1', 1000)],
        expense_options: [option('o1', 'e1', 300), option('o2', 'e1', 200)], // 최종 1500
        payments: [payment('p1', 'e1', 500, true), payment('p2', 'e1', 400, false)], // 실지출 500
      }, 5000),
    );
    expect(s.committed).toBe(1500);
    expect(s.actualSpent).toBe(500);
    expect(s.remaining).toBe(1000); // 1500 − 500 (약정 − 납부, 예산과 무관)
    expect(s.spentRate).toBe(33); // 500/1500 (메인 기준)
    expect(s.budgetRate).toBe(30); // 1500/5000 (참고자료)
  });

  test('경계: 약정 0이면 잔여 0 · spentRate 0 — 예산과 무관', () => {
    const s = selectBudgetSummary(snap({}, 5000)); // 지출 없음
    expect(s.committed).toBe(0);
    expect(s.remaining).toBe(0);
    expect(s.spentRate).toBe(0);
  });

  test('경계: 완납이면 잔여 0, spentRate 100', () => {
    const s = selectBudgetSummary(
      snap({ expenses: [expense('e1', 'a1', 5000)], payments: [payment('p1', 'e1', 5000, true)] }, 5000),
    );
    expect(s.remaining).toBe(0);
    expect(s.spentRate).toBe(100);
    expect(s.budgetRate).toBe(100);
  });

  test('경계: 과납이면 잔여 0으로 클램프(음수 아님)', () => {
    const s = selectBudgetSummary(
      snap({ expenses: [expense('e1', 'a1', 1000)], payments: [payment('p1', 'e1', 1500, true)] }, 5000),
    );
    expect(s.committed).toBe(1000);
    expect(s.actualSpent).toBe(1500);
    expect(s.remaining).toBe(0); // max(0, 1000 − 1500)
  });

  test('경계: 예산 0이면 budgetRate 0, spentRate는 예산과 무관하게 계산', () => {
    const s = selectBudgetSummary(
      snap({ expenses: [expense('e1', 'a1', 1000)], payments: [payment('p1', 'e1', 1000, true)] }, 0),
    );
    expect(s.budgetRate).toBe(0);
    expect(s.spentRate).toBe(100);
    expect(s.remaining).toBe(0); // 1000 − 1000
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest src/features/budget/api.test.ts -t selectBudgetSummary`
Expected: FAIL — "약정=기본+옵션 합…" 등에서 `remaining` 기대 불일치(현재 구현은 `totalBudget − committed` = 3500/… 반환).

- [ ] **Step 3: 셀렉터 구현 변경**

`src/features/budget/api.ts:47`의 한 줄을 교체한다.

변경 전:
```ts
  const remaining = totalBudget - committed;
```
변경 후:
```ts
  // 잔여 = 약정 − 납부(아직 못 낸 총액). 과납이면 0 클램프(개별 지출 잔금과 동일 규칙).
  // 사용자 결정 2026-11-10: 상단 3값이 약정|납부|잔여라, 예산 비교는 budgetRate 캡션으로 분리됐다.
  const remaining = Math.max(0, committed - actualSpent);
```

- [ ] **Step 4: 타입 주석 갱신**

`src/features/budget/types.ts:19`를 교체한다.

변경 전:
```ts
  remaining: number; // totalBudget − committed
```
변경 후:
```ts
  remaining: number; // 잔여 = max(0, committed − actualSpent) — 아직 못 낸 총액(과납 0 클램프)
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest src/features/budget/api.test.ts`
Expected: PASS (전체 통과).

- [ ] **Step 6: 커밋**

```bash
git add src/features/budget/api.ts src/features/budget/types.ts src/features/budget/api.test.ts
git commit -m "feat(budget): 상단 잔여를 '약정−납부'로 재정의(과납 0 클램프)"
```

---

### Task 2: 상단 요약 셀을 약정 | 납부 | 잔여로 재배치

**Files:**
- Modify: `src/features/budget/components/budget-summary.tsx`

RN 프레젠테이션 컴포넌트라 유닛 테스트는 추가하지 않는다(프로젝트 관례). tsc+eslint+런타임으로 검증한다.

- [ ] **Step 1: 3셀 영역 교체**

`budget-summary.tsx`의 상단 3셀 블록(현재 라인 25~43의 `<View style={{ flexDirection: 'row', marginTop: spacing.sm }}>…</View>`)을 아래로 교체한다. "예산"은 상단에서 빠지고(캡션으로 이동), 약정 셀만 탭 편집을 유지한다 → 예산 편집 진입은 Step 2의 캡션 탭으로 옮긴다.

```tsx
      <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
        {/* 약정(기본+옵션) */}
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="inkMuted">약정</Text>
          <Text variant="stat" tabularNums style={{ marginTop: 3 }}>{formatMan(committed)}</Text>
        </View>
        {/* 납부(완료 payment 합) */}
        <Cell label="납부" value={formatMan(actualSpent)} color="sageInk" />
        {/* 잔여(= 약정 − 납부) */}
        <Cell label="잔여" value={formatMan(remaining)} color="blushInk" />
      </View>
```

- [ ] **Step 2: 메인 미터 + 참고 캡션을 "예산 탭 편집" 캡션으로 교체**

같은 파일에서 현재 라인 45~55(메인 미터 블록 `{/* 메인 기준: … */}` ~ 참고 캡션 `참고 · 예산 대비 약정 {budgetRate}%` 까지)을 아래로 교체한다. 메인 미터(spentRate)는 유지하되, 그 아래 참고 줄을 "탭하여 수정" 가능한 예산 비교 캡션(④ 1안)으로 바꾼다.

```tsx
      {/* 메인 기준: 지출내역(약정) 대비 실지출 진행률 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <Text variant="caption" color="inkMuted">지출 진행률 · 약정 {formatMan(committed)} 중 납부 {formatMan(actualSpent)}</Text>
        <Text variant="bodySm" tabularNums>{spentRate}%</Text>
      </View>
      <Meter value={spentRate} color="sage" />

      {/* 참고자료(④ 1안): 예산 대비 약정 — 탭하면 전체 예산 수정 */}
      <Pressable
        onPress={() => setEditing(true)}
        accessibilityRole="button"
        accessibilityLabel="전체 예산 수정"
        style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}
      >
        <Text variant="caption" color="inkFaint">
          참고 · 예산 대비 약정 {budgetRate}% · 예산 {totalBudget > 0 ? formatMan(totalBudget) : '미설정 · 탭하여 설정'}
        </Text>
      </Pressable>
```

- [ ] **Step 3: 미사용 import 정리 확인**

`budget-summary.tsx` 상단 `import { Pressable, View } from 'react-native';`는 유지된다(Pressable 계속 사용). `AmountEditModal`·`useState`·`Cell`도 그대로 쓰인다. 변경 후 `View` 안에서 약정 셀이 더 이상 `Pressable`이 아니므로, 파일 내 `Pressable` 사용처가 Step 2 캡션 한 곳인지 확인(맞으면 import 유지).

- [ ] **Step 4: 타입체크·린트**

Run: `npx tsc --noEmit && npx eslint src/features/budget/components/budget-summary.tsx`
Expected: 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add src/features/budget/components/budget-summary.tsx
git commit -m "feat(budget): 상단 지표 약정|납부|잔여 + 예산 비교를 참고 캡션으로 이동"
```

---

### Task 3: 대시보드(요약+분담)를 흰 표면 카드로 래핑 (① C안)

**Files:**
- Modify: `src/app/(tabs)/budget.tsx:100-108`

- [ ] **Step 1: 요약·분담을 한 흰 카드 View로 감싸기**

`budget.tsx`에서 현재 `summary`렌더(라인 100~104)와 `Settlement`렌더(라인 106~108)를 아래 하나의 카드로 교체한다.

변경 전:
```tsx
        {summary ? (
          <View style={{ marginTop: spacing.lg }}>
            <BudgetSummary summary={summary} onEditTotal={(won) => updateTotal.mutate({ amount: won })} />
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xxxl }}>
          <Settlement rows={settlement} />
        </View>
```
변경 후:
```tsx
        {/* 대시보드(현황) — 흰 표면 패널로 입력 영역과 구분(① C안, 캘린더 패널과 동일 규범: surface+헤어라인, 그림자 없음) */}
        <View
          style={{
            marginTop: spacing.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.lineStrong,
            borderRadius: radius.md,
            padding: spacing.lg,
          }}
        >
          {summary ? (
            <BudgetSummary summary={summary} onEditTotal={(won) => updateTotal.mutate({ amount: won })} />
          ) : null}
          <View style={{ marginTop: spacing.xl }}>
            <Settlement rows={settlement} />
          </View>
        </View>
```

- [ ] **Step 2: `radius` import 추가**

`budget.tsx` 상단 import에서 `import { colors, layout, spacing } from '@/constants/theme';`를 `import { colors, layout, radius, spacing } from '@/constants/theme';`로 바꾼다(`colors`·`radius` 둘 다 사용).

- [ ] **Step 3: 타입체크·린트**

Run: `npx tsc --noEmit && npx eslint src/app/(tabs)/budget.tsx`
Expected: 0 errors.

- [ ] **Step 4: 커밋**

```bash
git add src/app/(tabs)/budget.tsx
git commit -m "feat(budget): 대시보드를 흰 표면 카드로 래핑해 입력 영역과 구분"
```

---

### Task 4: 지출 카드 아코디언化 (③ 접힘=한 줄, 펼침=상세+"수정")

**Files:**
- Modify: `src/features/budget/components/vendor-group.tsx` (전면 재작성)

- [ ] **Step 1: 컴포넌트 전면 교체**

`vendor-group.tsx` 전체를 아래로 교체한다. 변경점: 3셀 `Trio`·`Meter` 제거 → 한 줄 요약("약정 X · 납부 Y · 잔금 Z"). 로컬 `open` 상태로 헤더 탭=토글, 기본견적/옵션 라인 + "수정 →"은 펼침에만. "수정"이 `onEdit` 호출.

```tsx
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { VendorRole } from '@/types/db';
import type { VendorGroup as VendorGroupType } from '../types';

const ROLE_LABEL: Record<VendorRole, string> = { STUDIO: '스튜디오', DRESS: '드레스', MAKEUP: '메이크업' };

// 업체 묶음(또는 직접 지출) — 순수 CSS 아코디언의 RN판(로컬 open 상태).
// 접힘(기본): 이름 한 줄 + "약정·납부·잔금" 한 줄 요약(미터·3셀 박스 제거 — 사용자 피드백 2026-11-10).
// 펼침(헤더 탭): 기본 견적·옵션 라인 + "수정 →"(편집 모달 진입). 편집은 카드 전체 탭이 아니라 수정 링크로 분리.
export function VendorGroup({ group, onEdit }: { group: VendorGroupType; onEdit: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.line }}>
      {/* 헤더(탭 = 펼침 토글) */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${group.name} ${open ? '접기' : '펼치기'}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
      >
        {group.role ? <Chip variant="ghost" label={ROLE_LABEL[group.role]} /> : null}
        <Text variant="body" style={{ flexShrink: 1 }}>{group.name}</Text>
        {group.isDirect ? <Chip variant="ghost" label="직접 지출" /> : null}
        <View style={{ flex: 1 }} />
        <Text variant="caption" color="inkMuted">{open ? '▲' : '▼'}</Text>
      </Pressable>

      {/* 한 줄 요약: 약정 · 납부 · 잔금 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, gap: spacing.xs }}>
        <Text variant="caption" color="inkMuted">약정 </Text>
        <Text variant="caption" color="ink" tabularNums>{formatMan(group.finalAmount)}</Text>
        <Text variant="caption" color="inkFaint"> · </Text>
        <Text variant="caption" color="inkMuted">납부 </Text>
        <Text variant="caption" color="sageInk" tabularNums>{formatMan(group.paid)}</Text>
        <Text variant="caption" color="inkFaint"> · </Text>
        <Text variant="caption" color="inkMuted">잔금 </Text>
        <Text variant="caption" color="blushInk" tabularNums>{formatMan(group.remaining)}</Text>
      </View>

      {/* 펼침: 기본 견적 + 옵션 라인 + 수정 링크 */}
      {open ? (
        <View style={{ marginTop: spacing.sm }}>
          <View style={{ gap: 3 }}>
            {group.lines.map((line) => (
              <View key={line.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                <Text variant="meta" color={line.isOption ? 'blushInk' : 'inkMuted'} style={{ flexShrink: 1 }}>
                  {line.isOption ? `+ ${line.name}` : line.name}
                </Text>
                <Text variant="meta" color={line.isOption ? 'blushInk' : 'ink'} tabularNums>
                  {formatMan(line.amount)}
                </Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`${group.name} 수정`}
            style={{ alignSelf: 'flex-end', paddingVertical: spacing.xs, marginTop: spacing.xs }}
          >
            <Text variant="caption" color="blushInk">수정 →</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: 타입체크·린트**

Run: `npx tsc --noEmit && npx eslint src/features/budget/components/vendor-group.tsx`
Expected: 0 errors (제거된 `Meter` import·`payPercent`·`Trio`가 더는 참조되지 않음).

- [ ] **Step 3: 커밋**

```bash
git add src/features/budget/components/vendor-group.tsx
git commit -m "feat(budget): 지출 카드 아코디언화 — 접힘 한 줄 요약, 펼침 상세+수정"
```

---

### Task 5: 영역 다중선택 드롭다운 필터 (⑤)

**Files:**
- Create: `src/features/budget/components/area-filter-dropdown.tsx`
- Modify: `src/app/(tabs)/budget.tsx`

영역 전체(`areas`)와 `selected: Set<string>`/`onChange`로 제어되는 단순 컴포넌트. RN엔 `:has()`가 없어 Modal 체크리스트로 구현(기존 ExpenseForm/AmountEditModal와 동일한 Modal 패턴). 빈 선택 = 전체.

- [ ] **Step 1: 신규 컴포넌트 생성**

`src/features/budget/components/area-filter-dropdown.tsx`를 아래 내용으로 생성한다.

```tsx
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area } from '@/types/db';

// 영역 다중선택 필터(⑤) — 빈 선택 = 전체 노출(하객 관계필터와 동일 OR 규칙의 RN판).
// RN엔 :has()가 없어 Modal 체크리스트로 구현. 선택 상태는 화면이 소유(클라이언트 전용, 저장 안 함).
export function AreaFilterDropdown({
  areas, selected, onChange,
}: {
  areas: Area[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.size > 0;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <View>
      {/* 트리거 pill — 선택 있으면 블러시 활성 톤 */}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="영역 필터"
        style={{
          alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
          paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: active ? 'transparent' : colors.lineStrong,
          backgroundColor: active ? colors.blushSoft : 'transparent',
        }}
      >
        <Text variant="caption" color={active ? 'blushInk' : 'inkMuted'}>
          영역{active ? ` · ${selected.size}` : ''} ▾
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center' }} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              marginHorizontal: layout.screenPadding, backgroundColor: colors.surface,
              borderRadius: radius.lg, padding: layout.screenPadding, gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs }}>
              <Text variant="title">영역 필터</Text>
              {active ? (
                <Pressable onPress={() => onChange(new Set())} accessibilityRole="button">
                  <Text variant="caption" color="blushInk">전체 보기</Text>
                </Pressable>
              ) : null}
            </View>
            {areas.map((a) => {
              const on = selected.has(a.id);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => toggle(a.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}
                >
                  <View
                    style={{
                      width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.6,
                      borderColor: on ? colors.blushInk : colors.lineStrong,
                      backgroundColor: on ? colors.blushInk : colors.surface,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {on ? <Text variant="caption" style={{ color: '#fff' }}>✓</Text> : null}
                  </View>
                  <Text variant="body">{a.name_ko}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 2: `radius.pill`·`radius.sm` 존재 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
확인: `radius.pill`·`radius.sm` 미존재면 tsc 에러가 난다. 에러가 나면 `src/constants/theme.ts`의 `radius` 토큰을 열어 실제 키명(예: `full`/`sm`/`md`)으로 교정한다. 에러 없으면 그대로 진행.

- [ ] **Step 3: 화면에 필터 상태·렌더 배선**

`budget.tsx`를 세 곳 수정한다.

(a) import에 컴포넌트 추가 — `AreaBreakdown` import 아래에 삽입:
```tsx
import { AreaFilterDropdown } from '@/features/budget/components/area-filter-dropdown';
```

(b) 상태 추가 — `const [detailId, setDetailId] = useState<string | null>(null);` 아래에:
```tsx
  // 영역 필터(⑤) — 클라이언트 전용. 빈 Set = 전체 노출.
  const [areaFilter, setAreaFilter] = useState<Set<string>>(new Set());
  const visibleBreakdown = areaFilter.size === 0
    ? breakdown
    : breakdown.filter((row) => areaFilter.has(row.area.id));
```

(c) 영역 목록 렌더 블록(현재 라인 110~124의 `<View style={{ marginTop: spacing.md }}>…</View>`)을 아래로 교체 — 필터 드롭다운을 목록 위에 두고 `visibleBreakdown`을 렌더:
```tsx
        <View style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm }}>
            <Text variant="title">영역별 배분</Text>
            <AreaFilterDropdown areas={areas} selected={areaFilter} onChange={setAreaFilter} />
          </View>
          {!hasExpenses ? (
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.sm }}>
              아직 지출이 없습니다. 아래 ‘지출 추가’로 시작하세요. 영역 예산은 각 영역의 금액을 탭해 설정합니다.
            </Text>
          ) : null}
          {visibleBreakdown.map((row) => (
            <AreaBreakdown
              key={row.area.id}
              row={row}
              onEditBudget={(areaId, won) => setAreaBudget.mutate({ areaId, amount: won })}
              onEditExpense={(expenseId) => setDetailId(expenseId)}
            />
          ))}
        </View>
```

- [ ] **Step 4: 타입체크·린트**

Run: `npx tsc --noEmit && npx eslint src/features/budget/components/area-filter-dropdown.tsx "src/app/(tabs)/budget.tsx"`
Expected: 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add src/features/budget/components/area-filter-dropdown.tsx "src/app/(tabs)/budget.tsx"
git commit -m "feat(budget): 영역 다중선택 드롭다운 필터 추가(빈 선택=전체)"
```

---

### Task 6: 전체 검증 + 문서 갱신

**Files:**
- Modify: `CLAUDE.md` (「현재 상태」 비용 문단 + 「아키텍처」 비용 함정)

- [ ] **Step 1: 전체 테스트·타입·린트**

Run: `npx jest && npx tsc --noEmit && npx eslint src`
Expected: 전부 PASS / 0 errors. (실패 시 해당 Task로 돌아가 수정)

- [ ] **Step 2: 런타임 확인(Expo web)**

Run: `npx expo start --web --port 8099` (백그라운드) 후 `/budget` 접속.
확인 항목(read_page / javascript_tool로 실측 — 이 환경은 스크린샷 타임아웃):
- 대시보드가 흰 패널(배경 #FFFFFF, 보더 lineStrong)로 감싸여 아래 영역 목록과 구분됨.
- 상단 3값이 "약정 / 납부 / 잔여"이고 잔여 = 약정−납부.
- 지출 카드가 기본 접힘(이름+한 줄 요약만), 헤더 탭 시 기본견적·옵션+"수정 →" 펼쳐짐, "수정" 탭 시 편집 모달.
- "영역 ▾" 탭 → 모달 체크리스트, 한 영역 체크 시 그 영역만 노출, "전체 보기"로 초기화.

- [ ] **Step 3: CLAUDE.md 「현재 상태」 비용 문단 갱신**

`CLAUDE.md`의 "비용 실구현 완료" 문단에, 아래 사실을 반영한다(낡은 문장은 지우고 현재 사실로 교체 — 이력 쌓지 않기):
- 대시보드(요약+분담)는 흰 표면 카드로 감싸 지출 목록과 구분(① C안).
- 상단 지표는 **약정 | 납부 | 잔여**(잔여 = max(0, 약정−납부)). 예산 비교(budgetRate)·전체 예산 수정은 그 아래 **참고 캡션 탭**으로 이동(④ 1안) — 기존 "예산" 셀은 상단에서 제거.
- 지출 카드는 **아코디언**(접힘=이름+"약정·납부·잔금" 한 줄, 펼침=기본견적·옵션+"수정 →"). 편집 진입이 카드 전체 탭 → **"수정" 링크**로 바뀜(헤더 탭은 펼침 토글).
- 영역별 배분 위에 **영역 다중선택 드롭다운 필터**(클라이언트 전용, 빈 선택=전체).

- [ ] **Step 4: CLAUDE.md 「아키텍처」 비용 함정 추가**

「아키텍처 → 비용 feature」 소절에 아래 함정 2개를 추가한다:
```
- **`BudgetSummary.remaining`은 "약정−납부"(미납 총액)지 "예산−약정"이 아니다**(사용자 결정
  2026-11-10): 상단 3값이 약정|납부|잔여로 바뀌면서 의미가 재정의됐다. 과납이면 0 클램프.
  예산 대비 비교는 `budgetRate`(참고 캡션)가 담당 — 둘을 혼동해 remaining에 totalBudget를 다시
  끌어오지 않는다.
- **영역 필터·아코디언 열림은 화면/카드 로컬 state다 — 스냅샷·셀렉터·캐시와 무관**: 영역 필터는
  `budget.tsx`의 `useState<Set>`로 `breakdown`을 클라이언트 필터링하고, 지출 카드 펼침은
  `vendor-group.tsx`의 로컬 `open`이다. 저장·RPC·Realtime 어디에도 안 닿는다. 지출 카드 "편집"
  진입은 헤더 탭(=펼침)이 아니라 펼친 뒤 **"수정 →" 링크**(`onEdit`)다.
```

- [ ] **Step 5: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: 비용 화면 대시보드/아코디언/필터 개선 반영"
```

---

## 완료 기준(Definition of Done)

- `npx jest` 전체 PASS (`selectBudgetSummary` 잔여=약정−납부 경계 포함), `npx tsc --noEmit` 0, `npx eslint src` 0.
- Expo web 런타임에서 ①~⑤ 전부 실동작 확인(흰 카드 구분 · 약정/납부/잔여 · 아코디언 접힘/펼침/수정 · 영역 필터).
- CLAUDE.md 「현재 상태」·「아키텍처」가 현재 사실과 일치.

## 하지 않는 것

- vendors 화면 본구현(범위 밖).
- 영역 필터·아코디언 상태의 서버 저장(항상 클라이언트 전용).
- 개별 지출 잔금(`VendorGroup.remaining`) 계산 로직 변경 — 집계 표기·레이아웃만.
- 마이그레이션 변경 없음(이번 작업은 스키마·RPC 무영향).

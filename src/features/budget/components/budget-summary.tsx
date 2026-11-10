import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Meter, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { BudgetSummary as BudgetSummaryType } from '../types';
import { AmountEditModal } from './amount-edit-modal';

// 상단 예산 요약 — 예산/약정/잔여 3값 + 지출 진행률 미터(실지출/약정, 메인 기준) + 예산 대비 약정
// (참고자료, 기준 아님 — 사용자 결정 2026-11-10: "예상 소비율은 예상과 실제 차이 비교용이지 기준이
// 아니다"). 예산 값은 탭하면 인라인 편집 모달(만원). 색은 예산 상태에만(One-Axis Color Rule):
// 약정=블러시-잉크, 잔여=세이지-잉크. 메인 미터는 납부 진행이라 vendor-group과 통일해 세이지.
export function BudgetSummary({
  summary, onEditTotal,
}: {
  summary: BudgetSummaryType;
  onEditTotal: (won: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { totalBudget, committed, actualSpent, remaining, spentRate, budgetRate } = summary;

  return (
    <View>
      <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
        {/* 예산(탭 편집) */}
        <Pressable
          style={{ flex: 1 }}
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel="전체 예산 수정"
        >
          <Text variant="caption" color="inkMuted">예산 · 탭하여 수정</Text>
          <Text variant="stat" tabularNums style={{ marginTop: 3 }}>
            {totalBudget > 0 ? formatMan(totalBudget) : '미설정'}
          </Text>
        </Pressable>

        {/* 약정(기본+옵션) */}
        <Cell label="약정(기본+옵션)" value={formatMan(committed)} color="blushInk" />
        {/* 잔여 */}
        <Cell label="잔여" value={formatMan(remaining)} color="sageInk" />
      </View>

      {/* 메인 기준: 지출내역(약정) 대비 실지출 진행률 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <Text variant="caption" color="inkMuted">지출 진행률 · 약정 {formatMan(committed)} 중 납부 {formatMan(actualSpent)}</Text>
        <Text variant="bodySm" tabularNums>{spentRate}%</Text>
      </View>
      <Meter value={spentRate} color="sage" />

      {/* 참고자료: 예산 대비 약정(예상과 실제 지출계획의 차이) — 기준 아님 */}
      <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
        참고 · 예산 대비 약정 {budgetRate}%
      </Text>

      <AmountEditModal
        visible={editing}
        title="전체 예산"
        initialWon={totalBudget}
        onSubmit={(won) => { setEditing(false); onEditTotal(won); }}
        onClose={() => setEditing(false)}
      />
    </View>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color: 'blushInk' | 'sageInk' }) {
  return (
    <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: spacing.md }}>
      <Text variant="caption" color="inkMuted">{label}</Text>
      <Text variant="stat" color={color} tabularNums style={{ marginTop: 3 }}>{value}</Text>
    </View>
  );
}

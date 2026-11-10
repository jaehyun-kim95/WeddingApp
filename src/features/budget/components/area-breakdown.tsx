import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Meter, Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { AreaBreakdown as AreaBreakdownType } from '../types';
import { AmountEditModal } from './amount-edit-modal';
import { VendorGroup } from './vendor-group';

// 영역별 배분 섹션 — 영역명 + 소계/예산(초과는 테라코타) + 예산 대비 미터 + 업체 묶음들.
// 영역 예산은 탭하면 인라인 편집. 지출 없는 영역도 노출(예산만 설정 가능).
export function AreaBreakdown({
  row, onEditBudget, onEditExpense,
}: {
  row: AreaBreakdownType;
  onEditBudget: (areaId: string, won: number) => void;
  onEditExpense: (expenseId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { area, budget, committed, isOver, groups } = row;
  // 미터 채움: 예산이 있으면 소계/예산, 없으면 0(트랙만).
  const meterValue = budget > 0 ? Math.min(100, Math.round((committed / budget) * 100)) : 0;

  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Text variant="titleSm">{area.name_ko}</Text>
        <Pressable
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel={`${area.name_ko} 예산 수정`}
          style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}
        >
          <Text variant="bodySm" color={isOver ? 'terracottaInk' : 'ink'} tabularNums>{formatMan(committed)}</Text>
          <Text variant="caption" color="inkMuted">
            / 예산 {budget > 0 ? formatMan(budget) : '미설정'}
          </Text>
        </Pressable>
      </View>

      <Meter value={meterValue} color={isOver ? 'terracotta' : 'blush'} trackColor="groundDeep" height={6} />

      {groups.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          {groups.map((g) => (
            <VendorGroup key={g.key} group={g} onEdit={() => onEditExpense(g.expenseId)} />
          ))}
        </View>
      ) : (
        <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.sm }}>
          아직 지출이 없습니다.
        </Text>
      )}

      <AmountEditModal
        visible={editing}
        title={`${area.name_ko} 예산`}
        initialWon={budget}
        onSubmit={(won) => { setEditing(false); onEditBudget(area.id, won); }}
        onClose={() => setEditing(false)}
      />
    </View>
  );
}

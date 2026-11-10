import { Pressable, View } from 'react-native';

import { Chip, Meter, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { VendorRole } from '@/types/db';
import type { VendorGroup as VendorGroupType } from '../types';

const ROLE_LABEL: Record<VendorRole, string> = { STUDIO: '스튜디오', DRESS: '드레스', MAKEUP: '메이크업' };

// 업체 묶음(또는 직접 지출) — 예정/납부/잔금 3셀(B안) + 납부 진행 미터 + 기본 견적·옵션 라인.
// 잔금은 계산 표기(약정−완료납부). 탭하면 그 지출 편집(onEdit).
export function VendorGroup({ group, onEdit }: { group: VendorGroupType; onEdit: () => void }) {
  const payPercent = group.finalAmount > 0 ? Math.min(100, Math.round((group.paid / group.finalAmount) * 100)) : 0;

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.line }}
    >
      {/* 헤더: 역할 칩 + 지출명 (+ 직접 지출 칩) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {group.role ? <Chip variant="ghost" label={ROLE_LABEL[group.role]} /> : null}
        <Text variant="body" style={{ flexShrink: 1 }}>{group.name}</Text>
        {group.isDirect ? <Chip variant="ghost" label="직접 지출" /> : null}
      </View>

      {/* 예정 | 납부 | 잔금 3셀 */}
      <View style={{ flexDirection: 'row', marginTop: spacing.sm, marginBottom: spacing.xs }}>
        <Trio k="예정" v={group.finalAmount} />
        <Trio k="납부" v={group.paid} color="sageInk" divider />
        <Trio k="잔금" v={group.remaining} color="blushInk" divider />
      </View>

      {/* 납부 진행 미터(세이지=낸 비율) */}
      <Meter value={payPercent} color="sage" trackColor="line" height={5} />

      {/* 기본 견적 + 옵션 라인 */}
      <View style={{ marginTop: spacing.sm, gap: 3 }}>
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
    </Pressable>
  );
}

// 3셀 중 한 칸. divider면 좌측 구분선.
function Trio({ k, v, color = 'ink', divider = false }: { k: string; v: number; color?: 'ink' | 'sageInk' | 'blushInk'; divider?: boolean }) {
  return (
    <View
      style={[
        { flex: 1, alignItems: 'center' },
        divider ? { borderLeftWidth: 1, borderLeftColor: colors.line } : null,
      ]}
    >
      <Text variant="caption" color="inkMuted">{k}</Text>
      <Text variant="titleSm" color={color} tabularNums style={{ marginTop: 2 }}>{formatMan(v)}</Text>
    </View>
  );
}

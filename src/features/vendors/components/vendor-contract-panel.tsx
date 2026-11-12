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

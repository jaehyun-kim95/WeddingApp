import { Pressable, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { AttendStatus, Guest } from '@/types/db';
import { ATTEND_LABEL, RELATION_LABEL } from '../api';

// 참석 상태 순환 순서(목업 "참석/미정/불참" 칩 탭 전환). 칩 톤은 기존 변형만 재사용 —
// ATTENDING=plan(세이지), MAYBE/ABSENT=ghost(중립). 새 색 토큰을 만들지 않는다.
const ATTEND_CYCLE: Record<AttendStatus, AttendStatus> = {
  ATTENDING: 'MAYBE', MAYBE: 'ABSENT', ABSENT: 'ATTENDING',
};
const ATTEND_CHIP_VARIANT: Record<AttendStatus, 'plan' | 'ghost'> = {
  ATTENDING: 'plan', MAYBE: 'ghost', ABSENT: 'ghost',
};

// 한 하객 행. 관계 칩 + 이름(+혼주 표기, is_host bool만 — memo 오용 금지) + "식사 N" 서브텍스트
// (+메모 있으면 이어붙임) + 우측 참석 상태 칩(탭하면 순환)·축의금. 행 전체 탭은 onEdit, 참석 칩은
// 별도 Pressable+stopPropagation으로 분리해 탭 충돌을 막는다. 터치 타겟은 hitSlop으로 24×24 이상.
export function GuestRow({
  guest, first = false, onEdit, onCycleAttend,
}: {
  guest: Guest;
  first?: boolean;
  onEdit: () => void;
  onCycleAttend: (next: AttendStatus) => void;
}) {
  const gift = guest.gift_amount;

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.line,
      }}
    >
      <Chip variant="area" label={RELATION_LABEL[guest.relation]} />

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="body">{guest.name}</Text>
          {guest.is_host ? <Text variant="caption" color="inkMuted">· 혼주</Text> : null}
        </View>
        <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>
          식사 {guest.meal_count}{guest.memo ? ` · ${guest.memo}` : ''}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
        <Pressable
          onPress={(e) => { e.stopPropagation(); onCycleAttend(ATTEND_CYCLE[guest.attend_status]); }}
          accessibilityRole="button"
          accessibilityLabel="참석 상태 변경"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Chip variant={ATTEND_CHIP_VARIANT[guest.attend_status]} label={ATTEND_LABEL[guest.attend_status]} />
        </Pressable>
        <Text variant="bodySm" color={gift != null ? 'blushInk' : 'inkMuted'} tabularNums>
          {gift != null ? formatMan(gift) : '미접수'}
        </Text>
      </View>
    </Pressable>
  );
}

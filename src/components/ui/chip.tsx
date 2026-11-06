import { View, type ViewProps } from 'react-native';

import { colors, radius } from '@/constants/theme';
import type { ColorToken } from '@/constants/theme';
import { Text } from './text';

// 상태/태그 칩. DESIGN.md Chips 규범 — 배경은 역할색 -soft, 텍스트는 역할색 -ink, 테두리 없음.
// ghost는 투명 + lineStrong 보더(중립 라벨). overdue/today/upcoming은 체크리스트 날짜 상태 전용
// (실사용 피드백 — 지남=테라코타 재사용, 오늘=세이지(초록 계열, 재차 피드백으로 블러시→세이지
// 교정), 예정=신규 블루).
export type ChipVariant = 'soon' | 'plan' | 'area' | 'ghost' | 'overdue' | 'today' | 'upcoming';

const VARIANTS: Record<ChipVariant, { bg?: ColorToken; fg: ColorToken; border?: ColorToken }> = {
  soon: { bg: 'terracottaSoft', fg: 'terracottaInk' }, // 임박
  plan: { bg: 'sageSoft', fg: 'sageInk' }, // 예정(날짜 없음)
  area: { bg: 'blushSoft', fg: 'blushInk' }, // 준비영역 태그
  ghost: { fg: 'inkMuted', border: 'lineStrong' }, // 중립
  overdue: { bg: 'terracottaSoft', fg: 'terracottaInk' }, // 지남
  today: { bg: 'sageSoft', fg: 'sageInk' }, // 오늘
  upcoming: { bg: 'infoSoft', fg: 'infoInk' }, // 예정(날짜 있음)
};

export type ChipProps = ViewProps & {
  variant?: ChipVariant;
  label: string;
};

export function Chip({ variant = 'plan', label, style, ...rest }: ChipProps) {
  const v = VARIANTS[variant];
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          paddingVertical: 3,
          paddingHorizontal: 9,
          borderRadius: radius.pill,
          backgroundColor: v.bg ? colors[v.bg] : 'transparent',
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ? colors[v.border] : undefined,
        },
        style,
      ]}
      {...rest}
    >
      <Text variant="label" color={v.fg}>
        {label}
      </Text>
    </View>
  );
}

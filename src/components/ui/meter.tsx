import { View, type ViewProps } from 'react-native';

import { colors, radius } from '@/constants/theme';
import type { ColorToken } from '@/constants/theme';

// 진행률/소비율 미터. One-Axis Color Rule — 색이 의미를 나르는 축이면 역할색(sage/blush/terracotta),
// 중립 축(분담 정산 등)이면 color를 inkMuted로 넘겨 색을 빼고 길이·라벨로만 구분한다.
export type MeterProps = ViewProps & {
  value: number;
  max?: number;
  color?: ColorToken;
  trackColor?: ColorToken;
  height?: number;
};

export function Meter({
  value,
  max = 100,
  color = 'sage',
  trackColor = 'groundDeep',
  height = 8,
  style,
  ...rest
}: MeterProps) {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: value }}
      style={[
        { height, borderRadius: radius.pill, backgroundColor: colors[trackColor], overflow: 'hidden' },
        style,
      ]}
      {...rest}
    >
      <View
        style={{
          width: `${ratio * 100}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: colors[color],
        }}
      />
    </View>
  );
}

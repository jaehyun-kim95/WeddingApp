import { useEffect, useState } from 'react';
import { Animated, Easing, View, type ViewProps } from 'react-native';

import { colors, radius } from '@/constants/theme';
import type { ColorToken } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

// 진행률/소비율 미터. One-Axis Color Rule — 색이 의미를 나르는 축이면 역할색(sage/blush/terracotta),
// 중립 축(분담 정산 등)이면 color를 inkMuted로 넘겨 색을 빼고 길이·라벨로만 구분한다.
// value 변화는 즉시 점프가 아니라 부드럽게 늘고 줄게(Segmented와 같은 translateX 모션 어휘를
// width에 적용) — reduce-motion에서는 즉시 반영.
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
  const reduced = useReducedMotion();
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  // 지연 초기화 state로 안정 인스턴스 확보(React Compiler: 렌더 중 ref 접근 금지).
  const [anim] = useState(() => new Animated.Value(ratio));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: ratio,
      duration: reduced ? 0 : 400,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false, // width 애니메이션은 네이티브 드라이버 미지원(레이아웃 속성)
    }).start();
  }, [ratio, reduced, anim]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

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
      <Animated.View
        style={{
          width,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: colors[color],
        }}
      />
    </View>
  );
}

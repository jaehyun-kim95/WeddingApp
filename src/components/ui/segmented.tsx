import { useEffect, useState } from 'react';
import { Animated, Easing, type LayoutChangeEvent, Pressable, View } from 'react-native';

import { colors, radius, shadow } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Text } from './text';

// 세그먼트 뷰 전환 컨트롤(캘린더/리스트 등). DESIGN.md Segmented 규범 — ground-deep 트랙 위에 등폭
// 세그먼트 + 미끄러지는 흰 썸(ambientTile 그림자). 썸은 translateX 0.28s cubic-bezier로 이동,
// reduce-motion에서는 즉시 이동. 썸 폭은 트랙 실측(onLayout) 후 등폭 계산 — 라디오 기반 CSS 목업의
// RN 대응(상태 기반). 등폭 2~N개 세그먼트 전제.
const PAD = 3;
const BORDER = 1;

export type SegmentedOption = { key: string; label: string };
export type SegmentedProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (key: string) => void;
};

export function Segmented({ options, value, onChange }: SegmentedProps) {
  const reduced = useReducedMotion();
  const n = options.length;
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const [trackW, setTrackW] = useState(0);
  const segW = trackW > 0 ? (trackW - (BORDER + PAD) * 2) / n : 0;
  // 지연 초기화 state로 안정 인스턴스 확보(React Compiler: 렌더 중 ref 접근 금지). 동작은 useRef와 동일.
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: index * segW,
      duration: reduced ? 0 : 280,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [index, segW, reduced, anim]);

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.groundDeep,
        borderWidth: BORDER,
        borderColor: colors.lineStrong,
        borderRadius: radius.pill,
        padding: PAD,
      }}
    >
      {segW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: PAD,
            bottom: PAD,
            left: PAD,
            width: segW,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            transform: [{ translateX: anim }],
            ...shadow.ambientTile,
          }}
        />
      ) : null}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingVertical: 7 }}
          >
            <Text variant="meta" color={active ? 'ink' : 'inkMuted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

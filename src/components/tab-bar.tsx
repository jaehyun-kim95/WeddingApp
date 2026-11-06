import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { Text } from './ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

// 커스텀 하단 탭바. 기본 탭바(색만 다른 라벨)를 대체해 ① 라벨을 Body-sm(14px)로 키우고
// ② Segmented와 동일한 translateX 슬라이딩 인디케이터로 "지금 어디 있는지"를 더 분명히 한다
// (실사용 피드백 반영 — DESIGN.md Navigation 절 갱신 필요).
export function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const n = state.routes.length;
  const [trackW, setTrackW] = useState(0);
  const segW = trackW > 0 ? trackW / n : 0;
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: state.index * segW,
      duration: reduced ? 0 : 280,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [state.index, segW, reduced, anim]);

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.groundDeep,
        borderTopWidth: 1,
        borderTopColor: colors.lineStrong,
        height: layout.tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
      }}
    >
      {segW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: segW,
            height: 2,
            backgroundColor: colors.blushInk,
            transform: [{ translateX: anim }],
          }}
        />
      ) : null}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const active = state.index === index;
        return (
          <Pressable
            key={route.key}
            onPress={() => navigateToTab(route.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}
          >
            <Text variant="bodySm" color={active ? 'blushInk' : 'inkMuted'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

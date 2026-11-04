import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

// 토글 스위치. 켜짐=세이지(진행/활성), 꺼짐=lineStrong. 트랙 시각 크기는 38×22지만 터치 타겟이
// 24×24 미만이 되지 않도록 hitSlop으로 히트 영역을 넓힌다(WCAG AA — phase-2.md 미검증 항목 해소).
const TRACK_W = 38;
const TRACK_H = 22;
const THUMB = 18;
const PAD = 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2; // 16

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function Switch({ value, onValueChange, disabled = false }: SwitchProps) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: reduced ? 0 : 180,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [value, reduced, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: TRACK_W,
        height: TRACK_H,
        borderRadius: radius.pill,
        padding: PAD,
        backgroundColor: value ? colors.sage : colors.lineStrong,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          transform: [{ translateX }],
        }}
      />
    </Pressable>
  );
}

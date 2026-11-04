import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout, radius, shadow, spacing } from '@/constants/theme';
import { Text } from './text';

// 플로팅 추가 버튼(화면 공유). DESIGN.md FAB 규범 — 탭바와 같은 '중앙 정렬 앱 폭' 기준으로 떠서
// 앱 폭 내부 우측 하단, 탭바 바로 위에 놓인다. 래퍼는 pointerEvents box-none(터치 통과), 버튼만
// 눌린다. 배경은 blush가 아니라 blushInk — 흰 라벨과 AA 대비 확보.
export type FabProps = {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
};

export function Fab({ label, onPress, icon }: FabProps) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View pointerEvents="box-none" style={styles.inner}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
          {icon}
          <Text variant="bodySm" color="surface">
            {label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  inner: {
    width: '100%',
    maxWidth: layout.appMaxWidth,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.lg,
    alignItems: 'flex-end',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.blushInk,
    ...shadow.ambientShell,
  },
  pressed: { opacity: 0.9 },
});

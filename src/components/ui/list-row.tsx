import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { Text } from './text';

// 에디토리얼 리스트 행. DESIGN.md List Rows 규범 — 카드 컨테이너가 아니라 헤어라인(상단 1px)으로
// 구분한다. 좌측 리드 요소(체크박스 등)·제목/부제·우측 날짜/상태 3분할. 첫 행은 상단 괘선을 생략.
export type ListRowProps = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
};

export function ListRow({ title, subtitle, left, right, onPress, first = false }: ListRowProps) {
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.lg,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.line,
      }}
    >
      {left}
      <View style={{ flex: 1 }}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return content;
}

import { Pressable, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

// DESIGN.md 체크박스 20×20(시각). 터치 타겟은 hitSlop로 ≥44px 확보(시각 크기를 키우지 말 것).
export function CheckBox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{
        width: 20, height: 20, borderRadius: radius.sm,
        borderWidth: 1.5, borderColor: checked ? colors.sage : colors.lineStrong,
        backgroundColor: checked ? colors.sage : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {checked ? (
        <View style={{ width: 9, height: 5, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: colors.surface, transform: [{ rotate: '-45deg' }], marginTop: -2 }} />
      ) : null}
    </Pressable>
  );
}

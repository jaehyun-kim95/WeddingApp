import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { Text } from './text';

// 버튼. DESIGN.md Buttons — pill. primary=블러시 채움+흰 텍스트, ghost=투명+lineStrong 보더.
// 높이 44로 터치 타겟 확보.
export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'ghost';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'primary', disabled = false, style, ...rest }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state: PressableStateCallbackType) => [
        {
          height: 44,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? colors.blush : 'transparent',
          borderWidth: primary ? 0 : 1,
          borderColor: primary ? undefined : colors.lineStrong,
          opacity: disabled ? 0.5 : state.pressed ? 0.9 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text variant="bodySm" color={primary ? 'surface' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

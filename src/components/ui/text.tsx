import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import * as tokens from '@/constants/theme';
import type { ColorToken, TypeToken } from '@/constants/theme';

// 디자인 시스템 텍스트 프리미티브. DESIGN.md 11단계 타이포 스케일(variant)과 색 토큰(color)만
// 받는다 — 표 밖의 크기를 임의로 만들지 않기 위함. 숫자(날짜·금액·D-day)에는 tabularNums를 켠다.
export type AppTextProps = TextProps & {
  variant?: TypeToken;
  color?: ColorToken;
  tabularNums?: boolean;
};

export function Text({ variant = 'body', color = 'ink', tabularNums = false, style, ...rest }: AppTextProps) {
  const t = tokens.type[variant];
  const base: TextStyle = {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontWeight: t.fontWeight as TextStyle['fontWeight'],
    color: tokens.colors[color],
    letterSpacing: (t as { letterSpacing?: number }).letterSpacing,
    fontVariant: tabularNums ? ['tabular-nums'] : undefined,
  };

  return <RNText style={[base, style]} {...rest} />;
}

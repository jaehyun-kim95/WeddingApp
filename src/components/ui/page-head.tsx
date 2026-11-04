import { View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { Text } from './text';

// 서브 화면 헤더. DESIGN.md Page Head 규범 — 좌측 Subtitle(26) 제목 + Meta(13) 서브텍스트,
// 우측 Stat(22) 소형 D-day 레퍼런스. 하단 lineStrong 헤어라인 1px. 거대한 D-day 센터피스는 홈 전용.
export type PageHeadProps = {
  title: string;
  sub?: string;
  dday?: string;
};

export function PageHead({ title, sub, dday }: PageHeadProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.lineStrong,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="subtitle" color="ink">
          {title}
        </Text>
        {sub ? (
          <Text variant="meta" color="inkMuted" style={{ marginTop: 4 }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {dday ? (
        <Text variant="stat" color="blushInk" tabularNums>
          {dday}
        </Text>
      ) : null}
    </View>
  );
}

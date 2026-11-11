import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';

// 홈 마스트헤드 — 신랑&신부 이름(Headline) + 날짜·시간·장소 메타(formatWeddingMeta, 미정이면
// 생략) + 우측 설정 진입점. 네비게이션 모델상 설정은 더보기 메뉴가 아니라 이 톱니로 들어간다
// (CLAUDE.md 「네비게이션 모델」). 아이콘 라이브러리 미도입 결정에 따라 드로운 SVG 대신 글리프(⚙)로
// 최소 구현 — accessibilityLabel로 의미를 보강한다.
export function Masthead({
  groomName, brideName, metaLabel, onPressSettings,
}: {
  groomName: string;
  brideName: string;
  metaLabel: string | null;
  onPressSettings: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.lg,
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.lineStrong,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="headline">
          {groomName}
          <Text variant="headline" color="blushInk" style={{ fontWeight: '400' }}>
            {' & '}
          </Text>
          {brideName}
        </Text>
        {metaLabel ? (
          <Text variant="meta" color="inkMuted" style={{ marginTop: spacing.sm }}>
            {metaLabel}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onPressSettings}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="설정"
        style={{
          width: 40, height: 40, borderRadius: radius.pill,
          borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18 }} color="inkMuted">⚙</Text>
      </Pressable>
    </View>
  );
}

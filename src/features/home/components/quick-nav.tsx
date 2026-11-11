import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';

export type QuickNavItem = { key: string; label: string; onPress: () => void };

const PILL_PAD_H = 14; // 결정 목업(②-1 콤팩트 필) 그대로 — spacing 스케일(12/16)엔 없는 중간값.

// 바로가기 밴드(가로 스크롤) — 사용자 결정(2026-11-11 UI 리뷰, ②-1·③-B)으로 두 번 교정:
// 아이콘 없는 라벨 전용인데 52px 정사각 타일은 글자 대비 상자가 커 보여 34px 높이 "콤팩트 필"로
// 축소했고(①), 구역 자체도 상하 헤어라인으로 감싸 "바로가기"가 독립된 밴드임을 분명히 했다(②,
// design/home.html 원안의 `.band` 규범 — 그림자·추가 색 없이 헤어라인만). 양 끝 대칭 스페이서는
// ScrollView contentContainerStyle 패딩으로 준다.
export function QuickNav({ items }: { items: QuickNavItem[] }) {
  return (
    <View style={{
      borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineStrong,
      paddingVertical: spacing.xl,
    }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: layout.screenPadding, gap: spacing.sm }}
      >
        {items.map((it) => (
          <Pressable
            key={it.key}
            onPress={it.onPress}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            style={({ pressed }) => [
              {
                height: 34, paddingHorizontal: PILL_PAD_H,
                borderRadius: radius.pill, backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.lineStrong,
                alignItems: 'center', justifyContent: 'center',
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View>
              <Text variant="caption" color="ink">{it.label}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

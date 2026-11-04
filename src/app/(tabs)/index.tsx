import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';

// 홈 — Phase 0 뼈대 플레이스홀더. D-day 센터피스 등 실제 홈은 Phase 1에서 구현.
export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: layout.screenPadding,
          gap: spacing.sm,
        }}
      >
        <Text variant="headline" color="ink">
          우리 결혼 준비
        </Text>
        <Text variant="meta" color="inkFaint">
          홈 · 준비 중
        </Text>
      </View>
    </SafeAreaView>
  );
}

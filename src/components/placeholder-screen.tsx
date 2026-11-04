import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHead, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';

// Phase 0 뼈대용 플레이스홀더. 실제 화면은 Phase 1~3에서 구현한다.
// 탭 화면용(상단 SafeArea + PageHead). 서브 화면은 네이티브 헤더가 제목을 주므로 CenteredNote만 쓴다.
export function PlaceholderScreen({ title, sub, dday }: { title: string; sub?: string; dday?: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg }}>
        <PageHead title={title} sub={sub} dday={dday} />
        <CenteredNote />
      </View>
    </SafeAreaView>
  );
}

export function CenteredNote({ label = '준비 중 — Phase 1~3에서 구현' }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="meta" color="inkFaint">
        {label}
      </Text>
    </View>
  );
}

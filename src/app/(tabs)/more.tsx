import { type Href, useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, PageHead } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';

// 더보기 메뉴 허브(CLAUDE.md 네비게이션 모델). 서브 화면으로 push. 설정도 여기서 진입(톱니는 Phase 1).
const ITEMS: { title: string; href: Href }[] = [
  { title: '준비영역 모아보기', href: '/areas' },
  { title: '업체 관리', href: '/vendors' },
  { title: '하객 관리', href: '/guests' },
  { title: '갤러리', href: '/gallery' },
  { title: '설정', href: '/settings' },
];

export default function MoreScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <View style={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg }}>
        <PageHead title="더보기" />
        <View style={{ marginTop: spacing.sm }}>
          {ITEMS.map((it, i) => (
            <ListRow key={it.title} title={it.title} first={i === 0} onPress={() => router.push(it.href)} />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

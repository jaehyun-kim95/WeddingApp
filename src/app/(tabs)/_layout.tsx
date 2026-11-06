import { Tabs } from 'expo-router';

import { TabBar } from '@/components/tab-bar';
import * as theme from '@/constants/theme';

// 하단 탭바 5개(홈·일정·체크·비용·더보기). 커스텀 TabBar(`@/components/tab-bar`)가 렌더를 전담—
// Body-sm(14px) 라벨 + 활성 탭 슬라이딩 인디케이터(DESIGN.md Navigation 절 갱신, 실사용 피드백).
// 드로운 SVG 아이콘은 Phase 1 폴리시로 이월 — 지금은 라벨 전용.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.ground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="schedule" options={{ title: '일정' }} />
      <Tabs.Screen name="checklist" options={{ title: '체크' }} />
      <Tabs.Screen name="budget" options={{ title: '비용' }} />
      <Tabs.Screen name="more" options={{ title: '더보기' }} />
    </Tabs>
  );
}

import { Tabs } from 'expo-router';

import * as theme from '@/constants/theme';

// 하단 탭바 5개(홈·일정·체크·비용·더보기). DESIGN.md Navigation — 오프화이트 틴트, 활성=blushInk,
// 비활성=inkMuted, 11px 라벨. 드로운 SVG 아이콘은 Phase 1 폴리시로 이월 — 지금은 라벨 전용.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.blushInk,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarIconStyle: { display: 'none' }, // 아이콘 자리 제거(라벨 전용)
        tabBarLabelStyle: {
          fontFamily: theme.type.label.fontFamily,
          fontSize: theme.type.label.fontSize,
          letterSpacing: theme.type.label.letterSpacing,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.groundDeep,
          borderTopColor: theme.colors.lineStrong,
          borderTopWidth: 1,
        },
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

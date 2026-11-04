import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query-client';
import { ShareCodeProvider, useShareCode } from '@/providers/share-code-provider';
import { useAppFonts } from '@/hooks/use-app-fonts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // 디자인 시스템 폰트가 준비될 때까지 스플래시 유지.
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ShareCodeProvider>
        <SafeAreaProvider>
          <RootNav />
        </SafeAreaProvider>
      </ShareCodeProvider>
    </QueryClientProvider>
  );
}

// 온보딩 게이트: 공유 코드가 없으면 온보딩으로, 있으면서 온보딩에 있으면 앱으로 보낸다.
function RootNav() {
  const { status } = useShareCode();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const onOnboarding = segments[0] === 'onboarding';
    if (status === 'none' && !onOnboarding) {
      router.replace('/onboarding');
    } else if (status === 'ready' && onOnboarding) {
      router.replace('/');
    }
  }, [status, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      {/* 더보기 허브에서 push하는 서브 화면 — 네이티브 헤더로 제목+뒤로가기 제공 */}
      <Stack.Screen name="areas" options={{ headerShown: true, title: '준비영역 모아보기' }} />
      <Stack.Screen name="vendors" options={{ headerShown: true, title: '업체 관리' }} />
      <Stack.Screen name="guests" options={{ headerShown: true, title: '하객 관리' }} />
      <Stack.Screen name="gallery" options={{ headerShown: true, title: '갤러리' }} />
      <Stack.Screen name="settings" options={{ headerShown: true, title: '설정' }} />
    </Stack>
  );
}

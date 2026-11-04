import { QueryClient } from '@tanstack/react-query';

// 캐시-우선 체감(ADR-0002). 영속화(expo-sqlite/AsyncStorage persister)는 Phase 1에서 추가한다.
// 실시간 반영은 Broadcast 신호 수신 시 invalidateQueries로 스냅샷을 다시 받는 방식(ADR-0003).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

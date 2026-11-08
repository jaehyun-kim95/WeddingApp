import { useQuery } from '@tanstack/react-query';
import { getAuspiciousDays } from '@/lib/reference';

// 전역 참조라 거의 안 바뀌므로 길게 캐시한다(use-areas.ts와 동일 모양). 공유 코드와 무관.
export function useAuspiciousDays() {
  return useQuery({
    queryKey: ['auspiciousDays'],
    queryFn: getAuspiciousDays,
    staleTime: 1000 * 60 * 60, // 1h
  });
}

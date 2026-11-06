import { useQuery } from '@tanstack/react-query';
import { getAreas } from '@/lib/reference';

// 전역 참조 area는 거의 안 바뀌므로 길게 캐시한다. 공유 코드와 무관(커플 데이터 아님).
export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: getAreas,
    staleTime: 1000 * 60 * 60, // 1h
  });
}

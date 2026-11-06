import { useQuery } from '@tanstack/react-query';

import { getCoupleSnapshot } from '@/lib/rpc';
import { useShareCode } from '@/providers/share-code-provider';
import type { CoupleSnapshot } from '@/types/db';
import { selectCouple } from './api';
import { coupleKeys } from './keys';

// 모든 도메인 읽기의 기반(ADR-0003: 읽기는 단일 스냅샷). 공유 코드로 전체 스냅샷을 한 번 조회해
// 캐시하고, 각 도메인 훅은 이 위에 select로 자기 슬라이스를 얹는다. Realtime 무효화도 같은 키를 쓴다.
export function useCoupleSnapshot<TData = CoupleSnapshot>(
  select?: (snapshot: CoupleSnapshot) => TData,
) {
  const { shareCode } = useShareCode();
  return useQuery({
    // shareCode가 없으면 enabled:false라 조회하지 않는다(키는 안정적인 '' 자리표시).
    queryKey: coupleKeys.snapshot(shareCode ?? ''),
    queryFn: () => getCoupleSnapshot(shareCode as string),
    enabled: !!shareCode,
    select,
  });
}

// 커플 기본 정보(이름·날짜·장소·토글) 읽기 편의 훅.
export function useCouple() {
  return useCoupleSnapshot(selectCouple);
}

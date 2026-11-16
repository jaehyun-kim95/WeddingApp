import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { getCoupleSnapshot } from '@/lib/rpc';
import { useShareCode } from '@/providers/share-code-provider';
import type { CoupleSnapshot } from '@/types/db';
import * as api from './api';
import { applyUpdateCouple } from './cache';
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
  return useCoupleSnapshot(api.selectCouple);
}

// 결혼 정보·표시 토글 쓰기. 다른 feature의 useXxxMutation과 동일한 공통 배선(onMutate 패치/
// onError Alert+롤백/onSettled invalidate) — guests/budget 선례와 같은 모양이라 공유 추상화로
// 올리지 않는다(YAGNI, 기존 주석과 동일 판단).
export function useUpdateCouple() {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: (input: api.UpdateCoupleInput) => api.updateCouple(shareCode as string, input),
    onMutate: async (input: api.UpdateCoupleInput) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CoupleSnapshot>(key);
      if (prev) qc.setQueryData(key, applyUpdateCouple(prev, input));
      return { prev };
    },
    onError: (e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      Alert.alert('저장하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

// 공유 코드 재발급(ADR-0008, 재발급=교체) — 스냅샷 캐시가 아니라 공유 코드 자체가 바뀌므로
// 일반 패턴을 못 쓴다. 성공하면 ShareCodeProvider.save(newCode)로 전환(컨텍스트+SecureStore
// 갱신, useCoupleSnapshot이 새 쿼리 키로 자연히 전환). 이전 코드의 캐시는 그냥 버려둔다(재사용 안 됨).
export function useRegenerateShareCode() {
  const { shareCode, save } = useShareCode();
  return useMutation({
    mutationFn: () => api.regenerateShareCode(shareCode as string),
    onSuccess: (newCode: string) => { save(newCode); },
    onError: (e) => {
      Alert.alert('재발급하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
  });
}

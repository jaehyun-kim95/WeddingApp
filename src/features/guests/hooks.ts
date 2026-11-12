import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { AttendStatus, CoupleSnapshot, Guest } from '@/types/db';
import * as api from './api';
import * as cache from './cache';

// 하객 읽기. 공유 스냅샷 캐시 위에 select로 슬라이스를 얹는다(별도 조회 없음).
export function useGuests() {
  return useCoupleSnapshot(api.selectGuests);
}

export function useGuestSummary() {
  return useCoupleSnapshot(api.selectGuestSummary);
}

// 낙관적 뮤테이션 공통 배선: onMutate에서 스냅샷 캐시를 순수 리듀서로 즉시 패치,
// onError 롤백(이전 스냅샷 복원), onSettled invalidate(Realtime도 같은 키를 무효화해 수렴).
function useGuestMutation<TArgs>(
  mutationFn: (code: string, args: TArgs) => Promise<unknown>,
  optimistic: (s: CoupleSnapshot, args: TArgs) => CoupleSnapshot,
) {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: (args: TArgs) => mutationFn(shareCode as string, args),
    onMutate: async (args: TArgs) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CoupleSnapshot>(key);
      if (prev) qc.setQueryData(key, optimistic(prev, args));
      return { prev };
    },
    onError: (e, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      // 낙관적 업데이트를 조용히 롤백만 하면 "저장됐다가 사라짐"으로 보여 원인을 알 수 없다
      // (실측 사례: 0006 마이그레이션 미적용으로 RPC가 없어 실패했는데 화면은 아무 신호가 없었다).
      Alert.alert('저장하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCreateGuest() {
  return useGuestMutation<api.CreateGuestInput>(
    (code, input) => api.createGuest(code, input),
    (s, input) => {
      // 낙관적 임시 행(서버 응답 전). couple_id는 스냅샷에서, created_at은 now.
      const temp: Guest = {
        id: `optimistic-${Date.now()}`,
        created_at: new Date().toISOString(),
        couple_id: s.couple.id,
        name: input.name,
        side: input.side,
        relation: input.relation,
        attend_status: input.attendStatus,
        is_host: input.isHost,
        meal_count: input.mealCount,
        gift_amount: input.giftAmount ?? null,
        memo: input.memo ?? null,
      };
      return cache.applyCreate(s, temp);
    },
  );
}

export function useUpdateGuest() {
  return useGuestMutation<api.UpdateGuestInput>(
    (code, input) => api.updateGuest(code, input),
    (s, input) => cache.applyUpdate(s, input),
  );
}

export function useSetAttendStatus() {
  return useGuestMutation<{ id: string; status: AttendStatus }>(
    (code, { id, status }) => api.setAttendStatus(code, id, status),
    (s, { id, status }) => cache.applySetAttend(s, id, status),
  );
}

export function useDeleteGuest() {
  return useGuestMutation<{ id: string }>(
    (code, { id }) => api.deleteGuest(code, id),
    (s, { id }) => cache.applyDelete(s, id),
  );
}

export function useUpdateMealPrice() {
  return useGuestMutation<{ amount: number }>(
    (code, { amount }) => api.updateMealPrice(code, amount),
    (s, { amount }) => cache.applyMealPrice(s, amount),
  );
}

export function useImportGuests() {
  return useGuestMutation<api.ImportGuestRow[]>(
    (code, rows) => api.importGuests(code, rows),
    (s, rows) => {
      // 낙관적 임시 행 배열(서버 응답 전 — 임포트 결과 id로 교체는 invalidate가 수렴시킨다).
      const now = new Date().toISOString();
      const temps: Guest[] = rows.map((r, i) => ({
        id: `optimistic-${Date.now()}-${i}`,
        created_at: now,
        couple_id: s.couple.id,
        name: r.name,
        side: r.side,
        relation: r.relation,
        attend_status: r.attendStatus,
        is_host: r.isHost,
        meal_count: r.mealCount,
        gift_amount: r.giftAmount ?? null,
        memo: r.memo ?? null,
      }));
      return cache.applyImport(s, temps);
    },
  );
}

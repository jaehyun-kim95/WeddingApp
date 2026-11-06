import { useMutation, useQueryClient } from '@tanstack/react-query';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { ChecklistItem, CoupleSnapshot } from '@/types/db';
import * as api from './api';
import * as cache from './cache';

// 체크리스트 읽기. 공유 스냅샷 캐시 위에 select로 슬라이스를 얹는다(별도 조회 없음).
export function useChecklist() {
  return useCoupleSnapshot(api.selectChecklist);
}

// 낙관적 뮤테이션 공통 배선: onMutate에서 스냅샷 캐시를 순수 리듀서로 즉시 패치,
// onError 롤백(이전 스냅샷 복원), onSettled invalidate(Realtime도 같은 키를 무효화해 수렴).
function useChecklistMutation<TArgs>(
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
    onError: (_e, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCreateChecklistItem() {
  return useChecklistMutation<api.CreateChecklistItemInput>(
    (code, input) => api.createChecklistItem(code, input),
    (s, input) => {
      // 낙관적 임시 행(서버 응답 전). couple_id는 스냅샷에서, 정렬은 맨 뒤.
      const temp: ChecklistItem = {
        id: `optimistic-${Date.now()}`, created_at: new Date().toISOString(),
        couple_id: s.couple.id, area_id: input.areaId, title: input.title, assignee: input.assignee,
        is_done: false, done_at: null, due_date: input.dueDate ?? null, memo: input.memo ?? null,
        origin: 'USER', sort_order: Number.MAX_SAFE_INTEGER,
      };
      return cache.applyCreate(s, temp);
    },
  );
}

export function useUpdateChecklistItem() {
  return useChecklistMutation<api.UpdateChecklistItemInput>(
    (code, input) => api.updateChecklistItem(code, input),
    (s, input) => cache.applyUpdate(s, input),
  );
}

export function useToggleChecklistItem() {
  return useChecklistMutation<{ id: string; isDone: boolean }>(
    (code, { id, isDone }) => api.toggleChecklistItem(code, id, isDone),
    (s, { id, isDone }) => cache.applyToggle(s, id, isDone),
  );
}

export function useDeleteChecklistItem() {
  return useChecklistMutation<{ id: string }>(
    (code, { id }) => api.deleteChecklistItem(code, id),
    (s, { id }) => cache.applyDelete(s, id),
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { CoupleSnapshot, ScheduleEvent } from '@/types/db';
import * as api from './api';
import * as cache from './cache';

// 일정 읽기. 공유 스냅샷 캐시 위에 select로 슬라이스를 얹는다.
export function useSchedule() {
  return useCoupleSnapshot(api.selectSchedule);
}

// 낙관적 뮤테이션 공통 배선: onMutate에서 스냅샷 캐시를 순수 리듀서로 즉시 패치,
// onError 롤백(이전 스냅샷 복원), onSettled invalidate. checklist/hooks.ts와 동일 구조이지만
// 도메인 독립(단방향 계층) 원칙상 공유 추상화로 뽑지 않는다(두 군데뿐이라 YAGNI).
function useScheduleMutation<TArgs>(
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
      // 조용히 롤백만 하면 "저장됐다가 사라짐"으로 보여 원인을 알 수 없다(budget/guests와 동일 조치).
      Alert.alert('저장하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCreateScheduleEvent() {
  return useScheduleMutation<api.CreateScheduleEventInput>(
    (code, input) => api.createScheduleEvent(code, input),
    (s, input) => {
      // 낙관적 임시 행(서버 응답 전).
      const temp: ScheduleEvent = {
        id: `optimistic-${Date.now()}`, created_at: new Date().toISOString(),
        couple_id: s.couple.id, area_id: input.areaId ?? null, title: input.title,
        event_date: input.eventDate ?? null, event_time: input.eventTime ?? null,
        location: input.location ?? null, assignee: input.assignee ?? null,
        category: input.category, reminder_at: null, origin: 'USER',
      };
      return cache.applyCreate(s, temp);
    },
  );
}

export function useUpdateScheduleEvent() {
  return useScheduleMutation<api.UpdateScheduleEventInput>(
    (code, input) => api.updateScheduleEvent(code, input),
    (s, input) => cache.applyUpdate(s, input),
  );
}

export function useDeleteScheduleEvent() {
  return useScheduleMutation<{ id: string }>(
    (code, { id }) => api.deleteScheduleEvent(code, id),
    (s, { id }) => cache.applyDelete(s, id),
  );
}

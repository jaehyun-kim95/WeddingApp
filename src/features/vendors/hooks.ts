import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { Area, CoupleSnapshot, Vendor } from '@/types/db';
import * as api from './api';
import * as cache from './cache';

// 하객의 useGuestMutation과 동일 구조(세 번째 반복이지만 공유 추상화로 올리지 않음 — YAGNI 선례).
export function useVendors() {
  return useCoupleSnapshot(api.selectVendors);
}

// 영역 목록은 전역 참조(useAreas)에서 주입 — 스냅샷에 없으므로 인자로 받는다(budget 선례).
export function useVendorsByArea(areas: Area[]) {
  return useCoupleSnapshot((s) => api.selectVendorsByArea(s, areas));
}

function useVendorMutation<TArgs>(
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
      // 조용히 롤백만 하면 "저장됐다가 사라짐"으로 보여 원인을 알 수 없다(체크리스트·일정·비용·
      // 하객 4개 feature와 동일한 교훈 — 삭제 가드(연결된 지출 있음)도 이 Alert로 그대로 드러난다.
      Alert.alert('저장하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCreateVendor() {
  return useVendorMutation<api.CreateVendorInput>(
    (code, input) => api.createVendor(code, input),
    (s, input) => {
      const temp: Vendor = {
        id: `optimistic-${Date.now()}`,
        created_at: new Date().toISOString(),
        couple_id: s.couple.id,
        area_id: input.areaId,
        name: input.name,
        status: input.status ?? 'CANDIDATE',
        role: input.role ?? null,
        location: input.location ?? null,
        contract_date: input.contractDate ?? null,
        quoted_price: input.quotedPrice ?? null,
        memo: input.memo ?? null,
      };
      return cache.applyCreate(s, temp);
    },
  );
}

export function useUpdateVendor() {
  return useVendorMutation<api.UpdateVendorInput>(
    (code, input) => api.updateVendor(code, input),
    (s, input) => cache.applyUpdate(s, input),
  );
}

export function useDeleteVendor() {
  return useVendorMutation<{ id: string }>(
    (code, { id }) => api.deleteVendor(code, id),
    (s, { id }) => cache.applyDelete(s, id),
  );
}

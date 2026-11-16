import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { Area, CoupleSnapshot } from '@/types/db';
import * as api from './api';
import * as cache from './cache';
import { deletePhotoFile, type PickedPhoto, uploadPhotoFile } from './upload';

export function usePhotosByArea(areas: Area[]) {
  return useCoupleSnapshot((s) => api.selectPhotosByArea(s, areas));
}

export function useStorageUsage() {
  return useCoupleSnapshot((s) => {
    const totalBytes = api.totalSizeBytes(s);
    return { totalBytes, nearLimit: api.isNearStorageLimit(totalBytes), count: s.photos.length };
  });
}

// 업로드는 낙관적 캐시를 쓰지 않는다(cache.ts 주석 참고) — Storage 왕복이 끝난 뒤 성공 시
// invalidate로 실제 행을 받아온다. 실패하면 Alert로 사유를 보여준다(다른 4개 feature와 동일 교훈).
// 여러 장을 한 번에 올릴 때는 순차 업로드한다 — 중간에 하나가 실패해도 그 전까지 올라간 사진은
// 이미 독립된 행이라 되돌리지 않고(각 사진은 서로 의존하지 않는 개별 레코드), 실패 사유만 Alert로
// 보여준다.
export function useUploadPhoto() {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: async ({ areaId, picked }: { areaId: string; picked: PickedPhoto[] }) => {
      const snapshot = qc.getQueryData<CoupleSnapshot>(key);
      if (!snapshot) throw new Error('커플 정보를 불러오지 못했습니다.');
      for (const photo of picked) {
        const storagePath = await uploadPhotoFile(snapshot.couple.id, photo);
        await api.createPhoto(shareCode as string, { areaId, storagePath, sizeBytes: photo.sizeBytes });
      }
    },
    onError: (e) => {
      Alert.alert('업로드하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeletePhoto() {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await deletePhotoFile(storagePath);
      return api.deletePhoto(shareCode as string, id);
    },
    onMutate: async ({ id }: { id: string; storagePath: string }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CoupleSnapshot>(key);
      if (prev) qc.setQueryData(key, cache.applyDelete(prev, id));
      return { prev };
    },
    onError: (e, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      Alert.alert('삭제하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

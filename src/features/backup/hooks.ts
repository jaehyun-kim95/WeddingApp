import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { coupleKeys } from '@/features/couple';
import { getErrorMessage } from '@/lib/error-message';
import { useShareCode } from '@/providers/share-code-provider';
import type { CoupleSnapshot } from '@/types/db';
import * as api from './api';
import type { BackupData } from './backup-format';

// 백업 복원 뮤테이션 — 전체 교체(ADR-0009)라 낙관적 패치가 없다(onMutate 없음). 복원 중 화면은
// 기존 데이터를 그대로 보이다가, 성공 시 서버가 돌려준 스냅샷으로 캐시를 한 번에 갈아끼운다.
// 실패 시 Alert로 사유를 띄우고(다른 feature의 onError 규율과 동일), 마지막에 invalidate로 수렴시킨다
// (Realtime 대량 broadcast도 같은 키를 무효화 → 1회 재조회로 정리된다).
export function useRestoreBackup() {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: (data: BackupData) => api.restoreBackup(shareCode as string, data),
    onSuccess: (snapshot: CoupleSnapshot) => {
      // 서버가 복원 후 최신 스냅샷을 반환 → 즉시 캐시에 반영(재조회 전에도 화면이 새 데이터로 전환).
      qc.setQueryData(key, snapshot);
    },
    onError: (e) => {
      // getErrorMessage: Error 인스턴스뿐 아니라 postgrest-js의 fetch 실패 시 반환 모양
      // ({message,hint} 평범한 객체, Error 상속 아님)도 처리한다 — 2026-11-17 실기기에서
      // "알 수 없는 오류가 발생했습니다"만 보이던 원인(src/lib/error-message.ts 참고).
      Alert.alert('복원하지 못했습니다', getErrorMessage(e));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

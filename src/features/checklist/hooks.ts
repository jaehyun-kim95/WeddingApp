import { useCoupleSnapshot } from '@/features/couple';
import { selectChecklist } from './api';

// 체크리스트 읽기. 공유 스냅샷 캐시 위에 select로 슬라이스를 얹는다(별도 조회 없음).
export function useChecklist() {
  return useCoupleSnapshot(selectChecklist);
}

// TODO(Phase 1): useToggleChecklistItem 등 mutation 훅 — 스냅샷 캐시 낙관적 패치 + 실패 시 롤백.

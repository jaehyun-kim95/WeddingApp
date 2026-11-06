import { useCoupleSnapshot } from '@/features/couple';
import { selectSchedule } from './api';

// 일정 읽기. 공유 스냅샷 캐시 위에 select로 슬라이스를 얹는다.
export function useSchedule() {
  return useCoupleSnapshot(selectSchedule);
}

// TODO(Phase 1): useCreateScheduleEvent 등 mutation 훅 — 스냅샷 캐시 낙관적 패치.

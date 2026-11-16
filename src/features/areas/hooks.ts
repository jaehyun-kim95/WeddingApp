import { useCoupleSnapshot } from '@/features/couple';
import { todayDateString } from '@/features/checklist/api';
import { useAreas } from '@/hooks/use-areas';
import { selectAreaOverviews } from './api';

// 모아보기 읽기. areas(전역 참조)는 스냅샷 밖이라 별도 쿼리로 가져와 select에 주입한다
// (gallery의 usePhotosByArea(areas)와 동일 모양).
export function useAreaOverviews() {
  const { data: areas = [] } = useAreas();
  const today = todayDateString();
  return useCoupleSnapshot((s) => selectAreaOverviews(s, areas, today));
}

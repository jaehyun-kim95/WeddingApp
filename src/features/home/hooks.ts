import { useCoupleSnapshot } from '@/features/couple';
import * as api from './api';

// 홈 읽기. 공유 스냅샷 캐시 위에 select로 통합 피드를 얹는다(별도 조회 없음). 나머지 집계
// (D-day·진행률·소비율)는 홈 화면이 기존 도메인 배럴 훅을 직접 조합한다 — 홈 전용 훅은 이 하나뿐.
// limit은 useAreaBreakdown(areas)과 같은 인라인 클로저 패턴으로 주입한다.
export function useUpcomingFeed(limit = 4) {
  return useCoupleSnapshot((s) => api.selectUpcomingFeed(s, limit));
}

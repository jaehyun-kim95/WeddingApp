import { useCoupleSnapshot } from '@/features/couple';
import { selectExpensesWithTotals } from './api';

// 비용 읽기(기본+옵션→최종금액 조합). 공유 스냅샷 캐시 위에 select로 얹는다.
export function useExpenses() {
  return useCoupleSnapshot(selectExpensesWithTotals);
}

// TODO(Phase 1): useCreateExpense 등 mutation 훅 + 예산 요약(예산/약정/잔여) 집계 훅 — 스냅샷 캐시 낙관적 패치.

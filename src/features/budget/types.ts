import type { Expense, ExpenseOption } from '@/types/db';

// 뷰/파생 타입. 지출 1건을 "기본금액 + 옵션들 → 최종금액"으로 조합한 결과(비용 화면 업체별 묶음의 단위).
export type ExpenseWithTotal = {
  expense: Expense;
  options: ExpenseOption[];
  finalAmount: number; // base_amount + 옵션 amount 합
};

import type {
  CoupleSnapshot,
  ExpenseSplit,
  Payment,
} from '@/types/db';
import type { ExpenseWithTotal } from './types';

// 코어(순수) — RN/expo UI를 import하지 않는다. 비용은 지출의 단일 원장(ADR-0001).

// 읽기: 지출을 "기본금액 + 옵션 추가금 → 최종금액"으로 조합한다(업체별 묶음 뷰의 기초).
export function selectExpensesWithTotals(snapshot: CoupleSnapshot): ExpenseWithTotal[] {
  return snapshot.expenses.map((expense) => {
    const options = snapshot.expense_options.filter((o) => o.expense_id === expense.id);
    const finalAmount = options.reduce((sum, o) => sum + o.amount, expense.base_amount);
    return { expense, options, finalAmount };
  });
}

// 읽기: 분담(나/애인/양가) 슬라이스.
export function selectSplits(snapshot: CoupleSnapshot): ExpenseSplit[] {
  return snapshot.expense_splits;
}

// 읽기: 납부(예약금/잔금) 슬라이스. due_date는 일정 화면이 교차 참조한다.
export function selectPayments(snapshot: CoupleSnapshot): Payment[] {
  return snapshot.payments;
}

// 쓰기(지출·옵션·분담·납부 추가/수정/삭제)는 Phase 1 migration 0002의 쓰기 RPC 추가 후 lib/rpc 래퍼 호출.
// TODO(Phase 1): createExpense / updateExpense / deleteExpense / add·removeExpenseOption / setSplits / setPayments

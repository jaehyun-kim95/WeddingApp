import type {
  AreaBudget, CoupleSnapshot, Expense, ExpenseOption, Payment, Vendor,
} from '@/types/db';

// 스냅샷 캐시 낙관적 패치(순수·불변). CoupleSnapshot을 받아 새 스냅샷을 반환한다.
// 각 함수는 관련 슬라이스만 교체하고 나머지는 그대로 둔다. 완성된 행은 호출 훅이 만들어 넘긴다
// (checklist의 applyCreate가 full item을 받는 것과 동일 — toggle/총예산만 primitive).

// ── 지출(+옵션+납부 동시) ──
export function applyCreateExpense(
  s: CoupleSnapshot,
  expense: Expense,
  options: ExpenseOption[],
  payments: Payment[],
): CoupleSnapshot {
  return {
    ...s,
    expenses: [...s.expenses, expense],
    expense_options: [...s.expense_options, ...options],
    payments: [...s.payments, ...payments],
  };
}

export function applyUpdateExpense(
  s: CoupleSnapshot,
  patch: { id: string; title: string | null; baseAmount: number },
): CoupleSnapshot {
  return {
    ...s,
    expenses: s.expenses.map((e) =>
      e.id === patch.id ? { ...e, title: patch.title, base_amount: patch.baseAmount } : e,
    ),
  };
}

// 지출 삭제 — 연관 옵션·분담·납부도 함께 제거(DB FK cascade와 동일하게 낙관적 반영).
export function applyDeleteExpense(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return {
    ...s,
    expenses: s.expenses.filter((e) => e.id !== id),
    expense_options: s.expense_options.filter((o) => o.expense_id !== id),
    expense_splits: s.expense_splits.filter((sp) => sp.expense_id !== id),
    payments: s.payments.filter((p) => p.expense_id !== id),
  };
}

// ── 업체(인라인 생성) ──
export function applyCreateVendor(s: CoupleSnapshot, vendor: Vendor): CoupleSnapshot {
  return { ...s, vendors: [...s.vendors, vendor] };
}

// ── 옵션 ──
export function applyAddOption(s: CoupleSnapshot, option: ExpenseOption): CoupleSnapshot {
  return { ...s, expense_options: [...s.expense_options, option] };
}
export function applyDeleteOption(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return { ...s, expense_options: s.expense_options.filter((o) => o.id !== id) };
}

// ── 납부 ──
export function applyAddPayment(s: CoupleSnapshot, payment: Payment): CoupleSnapshot {
  return { ...s, payments: [...s.payments, payment] };
}
export function applyUpdatePayment(s: CoupleSnapshot, payment: Payment): CoupleSnapshot {
  return { ...s, payments: s.payments.map((p) => (p.id === payment.id ? payment : p)) };
}
export function applyDeletePayment(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return { ...s, payments: s.payments.filter((p) => p.id !== id) };
}
export function applyTogglePayment(s: CoupleSnapshot, id: string, isPaid: boolean): CoupleSnapshot {
  return {
    ...s,
    payments: s.payments.map((p) =>
      p.id === id ? { ...p, is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null } : p,
    ),
  };
}

// ── 예산 ──
// 영역 예산 upsert — (couple,area) 1행. 기존 영역이면 금액 교체, 없으면 추가.
export function applySetAreaBudget(s: CoupleSnapshot, budget: AreaBudget): CoupleSnapshot {
  const exists = s.area_budgets.some((b) => b.area_id === budget.area_id);
  return {
    ...s,
    area_budgets: exists
      ? s.area_budgets.map((b) => (b.area_id === budget.area_id ? budget : b))
      : [...s.area_budgets, budget],
  };
}

export function applyUpdateTotalBudget(s: CoupleSnapshot, amount: number): CoupleSnapshot {
  return { ...s, couple: { ...s.couple, total_budget: amount } };
}

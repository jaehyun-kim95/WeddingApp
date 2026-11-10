import type {
  Area, CoupleSnapshot, Expense, ExpenseOption, Payer, PaymentKind, Vendor,
} from '@/types/db';
import type {
  AreaBreakdown, BudgetSummary, ExpenseWithTotal, PayerSettlement, VendorGroup,
} from './types';
import * as rpc from '@/lib/rpc';

// 코어(순수) — RN/expo UI를 import하지 않는다. 셀렉터 + 쓰기(lib/rpc 위임). 비용은 지출 원장(ADR-0001),
// 분담 정산은 실납부(payment.payer) 기준(ADR-0004 — expense_split은 읽지 않는다).

// ── 공통 집계 헬퍼 ──
function optionsByExpense(snapshot: CoupleSnapshot): Map<string, ExpenseOption[]> {
  const map = new Map<string, ExpenseOption[]>();
  for (const o of snapshot.expense_options) {
    const bucket = map.get(o.expense_id) ?? [];
    bucket.push(o);
    map.set(o.expense_id, bucket);
  }
  return map;
}

function finalAmount(expense: Expense, options: ExpenseOption[]): number {
  return options.reduce((sum, o) => sum + o.amount, expense.base_amount);
}

// 읽기: 지출을 "기본금액 + 옵션 추가금 → 최종금액"으로 조합(업체별 묶음 뷰의 기초).
export function selectExpensesWithTotals(snapshot: CoupleSnapshot): ExpenseWithTotal[] {
  const opts = optionsByExpense(snapshot);
  return snapshot.expenses.map((expense) => {
    const options = opts.get(expense.id) ?? [];
    return { expense, options, finalAmount: finalAmount(expense, options) };
  });
}

// 읽기: 상단 예산 요약. 약정=Σ최종금액, 실지출=Σ납부완료.
// spentRate(메인 기준) = 실지출/약정 — "실제 입력한 지출내역 대비 얼마나 냈는지".
// budgetRate(참고자료) = 약정/예산 — "예상(예산)과 실제 지출계획의 차이"일 뿐 기준 아님(사용자 결정 2026-11-10).
export function selectBudgetSummary(snapshot: CoupleSnapshot): BudgetSummary {
  const totalBudget = snapshot.couple.total_budget;
  const opts = optionsByExpense(snapshot);
  const committed = snapshot.expenses.reduce(
    (sum, e) => sum + finalAmount(e, opts.get(e.id) ?? []),
    0,
  );
  const actualSpent = snapshot.payments.reduce((sum, p) => (p.is_paid ? sum + p.amount : sum), 0);
  const remaining = totalBudget - committed;
  const spentRate = committed <= 0 ? 0 : Math.round((actualSpent / committed) * 100);
  const budgetRate = totalBudget <= 0 ? 0 : Math.round((committed / totalBudget) * 100);
  return { totalBudget, committed, actualSpent, remaining, spentRate, budgetRate };
}

// 읽기: 분담 정산(신랑/신부/양가 + 미지정, 0이어도 노출). 실납부 기준.
// 미지정(payer=null)도 별도 행으로 노출한다 — 숨기면 그 금액이 분담에서 사라져 보여서(사용자 결정
// 2026-11-10). totalPaid는 미지정 포함 전체 완료 납부 합(= actualSpent와 동일 소스).
export function selectSettlementByPayer(snapshot: CoupleSnapshot): PayerSettlement[] {
  const paid = snapshot.payments.filter((p) => p.is_paid);
  const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
  const order: (Payer | null)[] = ['ME', 'PARTNER', 'BOTH_FAMILY', null];
  return order.map((payer) => {
    const amount = paid.reduce((sum, p) => (p.payer === payer ? sum + p.amount : sum), 0);
    const percent = totalPaid <= 0 ? 0 : Math.round((amount / totalPaid) * 100);
    return { payer, amount, percent };
  });
}

// 지출 1건 → 업체 묶음(vgroup). 업체 연결이면 이름=vendor.name, 직접 지출이면 title.
// paid = 해당 지출의 완료 납부 합, remaining(잔금) = max(0, 예정−납부)(과납이면 0으로 클램프).
function toVendorGroup(
  expense: Expense,
  options: ExpenseOption[],
  vendorById: Map<string, Vendor>,
  paid: number,
): VendorGroup {
  const vendor = expense.vendor_id ? vendorById.get(expense.vendor_id) ?? null : null;
  const lines = [
    { id: expense.id, name: '기본 견적', amount: expense.base_amount, isOption: false },
    ...options.map((o) => ({ id: o.id, name: o.name, amount: o.amount, isOption: true })),
  ];
  const final = finalAmount(expense, options);
  return {
    key: expense.id,
    expenseId: expense.id,
    name: vendor?.name ?? expense.title ?? '지출',
    isDirect: expense.vendor_id === null,
    role: vendor?.role ?? null,
    finalAmount: final,
    paid,
    remaining: Math.max(0, final - paid),
    lines,
  };
}

// 지출별 완료 납부 합계 맵(실납부 기준 — 잔금·납부 집계의 공통 소스).
function paidByExpense(snapshot: CoupleSnapshot): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of snapshot.payments) {
    if (!p.is_paid) continue;
    map.set(p.expense_id, (map.get(p.expense_id) ?? 0) + p.amount);
  }
  return map;
}

// 읽기: 영역별 배분(area sort_order 순, 6개 영역 전부 — 예산 설정을 위해 빈 영역도 노출).
// 각 영역 = 지출(업체 묶음) 리스트 + 소계 + 예산 대비 초과 플래그.
export function selectAreaBreakdown(snapshot: CoupleSnapshot, areas: Area[]): AreaBreakdown[] {
  const opts = optionsByExpense(snapshot);
  const paidMap = paidByExpense(snapshot);
  const vendorById = new Map(snapshot.vendors.map((v) => [v.id, v]));
  const budgetByArea = new Map(snapshot.area_budgets.map((b) => [b.area_id, b.amount]));

  return [...areas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => {
      const groups = snapshot.expenses
        .filter((e) => e.area_id === area.id)
        .map((e) => toVendorGroup(e, opts.get(e.id) ?? [], vendorById, paidMap.get(e.id) ?? 0));
      const committed = groups.reduce((sum, g) => sum + g.finalAmount, 0);
      const budget = budgetByArea.get(area.id) ?? 0;
      return { area, budget, committed, isOver: budget > 0 && committed > budget, groups };
    });
}

// 로컬 타임존 기준 오늘 날짜(YYYY-MM-DD). 도메인 독립(교차 import 회피)으로 이 파일에 둔다.
export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── 쓰기: lib/rpc 위임(ADR-0003 — supabase.rpc는 lib/rpc에만). shareCode는 호출 훅이 주입 ──
export type OptionInput = { name: string; amount: number };
export type PaymentInput = {
  kind: PaymentKind;
  amount: number;
  dueDate?: string | null;
  payer?: Payer | null;
  isPaid?: boolean;
};
export type CreateExpenseInput = {
  areaId: string;
  vendorId?: string | null;
  title?: string | null;
  baseAmount: number;
  options: OptionInput[];
  payments: PaymentInput[];
};
export type UpdateExpenseInput = { id: string; title?: string | null; baseAmount: number };
export type CreateVendorInput = { areaId: string; name: string };
export type AddPaymentInput = {
  expenseId: string;
  kind: PaymentKind;
  amount: number;
  dueDate?: string | null;
  payer?: Payer | null;
  isPaid?: boolean;
};
export type UpdatePaymentInput = {
  id: string;
  kind: PaymentKind;
  amount: number;
  dueDate?: string | null;
  payer?: Payer | null;
  isPaid?: boolean;
};

export function createExpense(shareCode: string, input: CreateExpenseInput) {
  return rpc.createExpense(shareCode, input);
}
export function updateExpense(shareCode: string, input: UpdateExpenseInput) {
  return rpc.updateExpense(shareCode, input);
}
export function deleteExpense(shareCode: string, id: string) {
  return rpc.deleteExpense(shareCode, id);
}
export function createVendor(shareCode: string, input: CreateVendorInput) {
  return rpc.createVendor(shareCode, input);
}
export function addExpenseOption(shareCode: string, expenseId: string, input: OptionInput) {
  return rpc.addExpenseOption(shareCode, expenseId, input);
}
export function deleteExpenseOption(shareCode: string, id: string) {
  return rpc.deleteExpenseOption(shareCode, id);
}
export function addPayment(shareCode: string, input: AddPaymentInput) {
  return rpc.addPayment(shareCode, input);
}
export function updatePayment(shareCode: string, input: UpdatePaymentInput) {
  return rpc.updatePayment(shareCode, input);
}
export function deletePayment(shareCode: string, id: string) {
  return rpc.deletePayment(shareCode, id);
}
export function togglePaymentPaid(shareCode: string, id: string, isPaid: boolean) {
  return rpc.togglePaymentPaid(shareCode, id, isPaid);
}
export function setAreaBudget(shareCode: string, areaId: string, amount: number) {
  return rpc.setAreaBudget(shareCode, areaId, amount);
}
export function updateTotalBudget(shareCode: string, amount: number) {
  return rpc.updateTotalBudget(shareCode, amount);
}

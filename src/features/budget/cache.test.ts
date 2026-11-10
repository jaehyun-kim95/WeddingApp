import type { AreaBudget, CoupleSnapshot, Expense, ExpenseOption, Payment } from '@/types/db';
import {
  applyAddOption, applyAddPayment, applyCreateExpense, applyDeleteExpense, applyDeleteOption,
  applyDeletePayment, applySetAreaBudget, applyTogglePayment, applyUpdateExpense,
  applyUpdatePayment, applyUpdateTotalBudget,
} from './cache';

const expense = (id: string, base = 1000): Expense => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', vendor_id: null, title: id, base_amount: base,
});
const option = (id: string, expenseId: string): ExpenseOption => ({
  id, created_at: '', couple_id: 'c1', expense_id: expenseId, name: id, amount: 100,
});
const payment = (id: string, expenseId: string, isPaid = false): Payment => ({
  id, created_at: '', couple_id: 'c1', expense_id: expenseId, kind: 'DEPOSIT', amount: 500,
  due_date: null, payer: null, is_paid: isPaid, paid_at: isPaid ? '2026-01-01T00:00:00Z' : null,
});
const budget = (areaId: string, amount: number): AreaBudget => ({
  id: `ab-${areaId}`, created_at: '', couple_id: 'c1', area_id: areaId, amount,
});

const snap = (p: Partial<CoupleSnapshot>): CoupleSnapshot =>
  ({
    couple: { id: 'c1', total_budget: 0 } as CoupleSnapshot['couple'],
    expenses: [], expense_options: [], expense_splits: [], payments: [], area_budgets: [], vendors: [],
    ...p,
  } as CoupleSnapshot);

describe('applyCreateExpense', () => {
  test('지출+옵션+납부를 각 슬라이스에 동시 추가, 원본 불변', () => {
    const s0 = snap({});
    const out = applyCreateExpense(s0, expense('e1'), [option('o1', 'e1')], [payment('p1', 'e1')]);
    expect(out.expenses).toHaveLength(1);
    expect(out.expense_options).toHaveLength(1);
    expect(out.payments).toHaveLength(1);
    expect(s0.expenses).toHaveLength(0); // 원본 보존
  });

  test('빈 옵션·납부 배열이어도 지출만 추가(병리)', () => {
    const out = applyCreateExpense(snap({}), expense('e1'), [], []);
    expect(out.expenses).toHaveLength(1);
    expect(out.expense_options).toHaveLength(0);
    expect(out.payments).toHaveLength(0);
  });
});

describe('applyUpdateExpense', () => {
  test('대상 지출의 title·base만 교체, 나머지 불변', () => {
    const out = applyUpdateExpense(snap({ expenses: [expense('e1', 1000), expense('e2', 2000)] }),
      { id: 'e1', title: '수정', baseAmount: 1500 });
    expect(out.expenses[0]).toMatchObject({ id: 'e1', title: '수정', base_amount: 1500 });
    expect(out.expenses[1]).toEqual(expense('e2', 2000));
  });
});

describe('applyDeleteExpense', () => {
  test('지출 + 연관 옵션·분담·납부 동반 삭제, 무관 항목 보존', () => {
    const s0 = snap({
      expenses: [expense('e1'), expense('e2')],
      expense_options: [option('o1', 'e1'), option('o2', 'e2')],
      payments: [payment('p1', 'e1'), payment('p2', 'e2')],
    });
    const out = applyDeleteExpense(s0, 'e1');
    expect(out.expenses.map((e) => e.id)).toEqual(['e2']);
    expect(out.expense_options.map((o) => o.id)).toEqual(['o2']);
    expect(out.payments.map((p) => p.id)).toEqual(['p2']);
  });

  test('병리: 없는 id 삭제는 무변경', () => {
    const s0 = snap({ expenses: [expense('e1')] });
    expect(applyDeleteExpense(s0, 'zzz').expenses).toEqual(s0.expenses);
  });
});

describe('옵션·납부 추가/삭제', () => {
  test('applyAddOption / applyDeleteOption', () => {
    const added = applyAddOption(snap({}), option('o1', 'e1'));
    expect(added.expense_options).toHaveLength(1);
    expect(applyDeleteOption(added, 'o1').expense_options).toHaveLength(0);
  });
  test('applyAddPayment / applyDeletePayment', () => {
    const added = applyAddPayment(snap({}), payment('p1', 'e1'));
    expect(added.payments).toHaveLength(1);
    expect(applyDeletePayment(added, 'p1').payments).toHaveLength(0);
  });
  test('applyUpdatePayment: 대상만 교체', () => {
    const s0 = snap({ payments: [payment('p1', 'e1'), payment('p2', 'e1')] });
    const out = applyUpdatePayment(s0, { ...payment('p1', 'e1', true), amount: 999 });
    expect(out.payments[0]).toMatchObject({ id: 'p1', amount: 999, is_paid: true });
    expect(out.payments[1]).toEqual(payment('p2', 'e1'));
  });
});

describe('applyTogglePayment', () => {
  test('is_paid·paid_at 쌍을 맞춘다', () => {
    const out = applyTogglePayment(snap({ payments: [payment('p1', 'e1', false)] }), 'p1', true);
    expect(out.payments[0].is_paid).toBe(true);
    expect(out.payments[0].paid_at).not.toBeNull();
  });
  test('멱등성: 두 번 토글하면 원복', () => {
    const s0 = snap({ payments: [payment('p1', 'e1', false)] });
    const s2 = applyTogglePayment(applyTogglePayment(s0, 'p1', true), 'p1', false);
    expect(s2.payments[0].is_paid).toBe(false);
    expect(s2.payments[0].paid_at).toBeNull();
  });
  test('병리: 없는 id는 무변경', () => {
    const s0 = snap({ payments: [payment('p1', 'e1')] });
    expect(applyTogglePayment(s0, 'zzz', true).payments).toEqual(s0.payments);
  });
});

describe('applySetAreaBudget (upsert)', () => {
  test('기존 영역이면 금액 교체(행 수 불변)', () => {
    const s0 = snap({ area_budgets: [budget('a1', 1000)] });
    const out = applySetAreaBudget(s0, budget('a1', 2000));
    expect(out.area_budgets).toHaveLength(1);
    expect(out.area_budgets[0].amount).toBe(2000);
  });
  test('새 영역이면 추가(기존 보존)', () => {
    const s0 = snap({ area_budgets: [budget('a1', 1000)] });
    const out = applySetAreaBudget(s0, budget('a2', 500));
    expect(out.area_budgets.map((b) => b.area_id).sort()).toEqual(['a1', 'a2']);
  });
});

describe('applyUpdateTotalBudget', () => {
  test('couple.total_budget만 교체, 나머지 보존', () => {
    const s0 = snap({ expenses: [expense('e1')] });
    const out = applyUpdateTotalBudget(s0, 7000);
    expect(out.couple.total_budget).toBe(7000);
    expect(out.expenses).toHaveLength(1);
  });
});

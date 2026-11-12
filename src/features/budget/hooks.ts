import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { coupleKeys, useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type {
  Area, AreaBudget, CoupleSnapshot, Expense, ExpenseOption, Payment, Vendor,
} from '@/types/db';
import * as api from './api';
import * as cache from './cache';

// ── 읽기(스냅샷 캐시 위에 select로 슬라이스를 얹는다, 별도 조회 없음) ──
export function useExpenses() {
  return useCoupleSnapshot(api.selectExpensesWithTotals);
}
export function useBudgetSummary() {
  return useCoupleSnapshot(api.selectBudgetSummary);
}
export function useSettlement() {
  return useCoupleSnapshot(api.selectSettlementByPayer);
}
// 영역 목록은 전역 참조(useAreas)에서 주입 — 스냅샷에 없으므로 인자로 받는다.
export function useAreaBreakdown(areas: Area[]) {
  return useCoupleSnapshot((s) => api.selectAreaBreakdown(s, areas));
}

// ── 낙관적 뮤테이션 공통 배선(체크리스트·일정과 동일 구조 — 두 선례대로 공유 모듈로 추상화하지
//    않는다, YAGNI). onMutate 패치 → onError 롤백 → onSettled invalidate(Realtime도 같은 키로 수렴). ──
function useBudgetMutation<TArgs>(
  mutationFn: (code: string, args: TArgs) => Promise<unknown>,
  optimistic: (s: CoupleSnapshot, args: TArgs) => CoupleSnapshot,
) {
  const { shareCode } = useShareCode();
  const qc = useQueryClient();
  const key = coupleKeys.snapshot(shareCode ?? '');
  return useMutation({
    mutationFn: (args: TArgs) => mutationFn(shareCode as string, args),
    onMutate: async (args: TArgs) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CoupleSnapshot>(key);
      if (prev) qc.setQueryData(key, optimistic(prev, args));
      return { prev };
    },
    onError: (e, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      // 조용히 롤백만 하면 "추가됐다가 사라짐"으로 보여 원인을 알 수 없다(실측 사례: 0005 마이그레이션
      // 미적용으로 payment_kind enum에 INTERIM이 없어 add_payment가 실패했는데 화면엔 신호가 없었다).
      Alert.alert('저장하지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

const tempId = (p: string) => `optimistic-${p}-${Date.now()}`;

// ── 지출(+옵션+납부 동시 생성) ──
export function useCreateExpense() {
  return useBudgetMutation<api.CreateExpenseInput>(
    (code, input) => api.createExpense(code, input),
    (s, input) => {
      const now = new Date().toISOString();
      const eid = tempId('exp');
      const title = input.title?.trim() ? input.title.trim() : null;
      const expense: Expense = {
        id: eid, created_at: now, couple_id: s.couple.id, area_id: input.areaId,
        vendor_id: input.vendorId ?? null, title, base_amount: input.baseAmount,
      };
      const options: ExpenseOption[] = input.options.map((o, i) => ({
        id: `${eid}-o${i}`, created_at: now, couple_id: s.couple.id, expense_id: eid,
        name: o.name, amount: o.amount,
      }));
      const payments: Payment[] = input.payments.map((p, i) => ({
        id: `${eid}-p${i}`, created_at: now, couple_id: s.couple.id, expense_id: eid,
        kind: p.kind, amount: p.amount, due_date: p.dueDate ?? null, payer: p.payer ?? null,
        is_paid: p.isPaid ?? false, paid_at: p.isPaid ? now : null,
      }));
      return cache.applyCreateExpense(s, expense, options, payments);
    },
  );
}

export function useUpdateExpense() {
  return useBudgetMutation<api.UpdateExpenseInput>(
    (code, input) => api.updateExpense(code, input),
    (s, input) =>
      cache.applyUpdateExpense(s, {
        id: input.id,
        title: input.title?.trim() ? input.title.trim() : null,
        baseAmount: input.baseAmount,
      }),
  );
}

export function useDeleteExpense() {
  return useBudgetMutation<{ id: string }>(
    (code, { id }) => api.deleteExpense(code, id),
    (s, { id }) => cache.applyDeleteExpense(s, id),
  );
}

// ── 업체 인라인 생성(지출에 묶을 업체) ──
export function useCreateVendor() {
  return useBudgetMutation<api.CreateVendorInput>(
    (code, input) => api.createVendor(code, input),
    (s, input) => {
      const vendor: Vendor = {
        id: tempId('ven'), created_at: new Date().toISOString(), couple_id: s.couple.id,
        area_id: input.areaId, name: input.name, status: 'CONTRACTED', role: null,
        location: null, contract_date: null, quoted_price: null, memo: null,
      };
      return cache.applyCreateVendor(s, vendor);
    },
  );
}

// ── 옵션 ──
export function useAddOption() {
  return useBudgetMutation<{ expenseId: string; input: api.OptionInput }>(
    (code, { expenseId, input }) => api.addExpenseOption(code, expenseId, input),
    (s, { expenseId, input }) =>
      cache.applyAddOption(s, {
        id: tempId('opt'), created_at: new Date().toISOString(), couple_id: s.couple.id,
        expense_id: expenseId, name: input.name, amount: input.amount,
      }),
  );
}
export function useDeleteOption() {
  return useBudgetMutation<{ id: string }>(
    (code, { id }) => api.deleteExpenseOption(code, id),
    (s, { id }) => cache.applyDeleteOption(s, id),
  );
}

// ── 납부 ──
export function useAddPayment() {
  return useBudgetMutation<api.AddPaymentInput>(
    (code, input) => api.addPayment(code, input),
    (s, input) => {
      const now = new Date().toISOString();
      const payment: Payment = {
        id: tempId('pay'), created_at: now, couple_id: s.couple.id, expense_id: input.expenseId,
        kind: input.kind, amount: input.amount, due_date: input.dueDate ?? null,
        payer: input.payer ?? null, is_paid: input.isPaid ?? false, paid_at: input.isPaid ? now : null,
      };
      return cache.applyAddPayment(s, payment);
    },
  );
}
export function useUpdatePayment() {
  return useBudgetMutation<api.UpdatePaymentInput>(
    (code, input) => api.updatePayment(code, input),
    (s, input) => {
      const existing = s.payments.find((p) => p.id === input.id);
      if (!existing) return s;
      const isPaid = input.isPaid ?? false;
      return cache.applyUpdatePayment(s, {
        ...existing, kind: input.kind, amount: input.amount, due_date: input.dueDate ?? null,
        payer: input.payer ?? null, is_paid: isPaid,
        paid_at: isPaid ? existing.paid_at ?? new Date().toISOString() : null,
      });
    },
  );
}
export function useDeletePayment() {
  return useBudgetMutation<{ id: string }>(
    (code, { id }) => api.deletePayment(code, id),
    (s, { id }) => cache.applyDeletePayment(s, id),
  );
}
export function useTogglePayment() {
  return useBudgetMutation<{ id: string; isPaid: boolean }>(
    (code, { id, isPaid }) => api.togglePaymentPaid(code, id, isPaid),
    (s, { id, isPaid }) => cache.applyTogglePayment(s, id, isPaid),
  );
}

// ── 예산 ──
export function useSetAreaBudget() {
  return useBudgetMutation<{ areaId: string; amount: number }>(
    (code, { areaId, amount }) => api.setAreaBudget(code, areaId, amount),
    (s, { areaId, amount }) => {
      const existing = s.area_budgets.find((b) => b.area_id === areaId);
      const budget: AreaBudget = existing
        ? { ...existing, amount }
        : {
            id: tempId('ab'), created_at: new Date().toISOString(), couple_id: s.couple.id,
            area_id: areaId, amount,
          };
      return cache.applySetAreaBudget(s, budget);
    },
  );
}
export function useUpdateTotalBudget() {
  return useBudgetMutation<{ amount: number }>(
    (code, { amount }) => api.updateTotalBudget(code, amount),
    (s, { amount }) => cache.applyUpdateTotalBudget(s, amount),
  );
}

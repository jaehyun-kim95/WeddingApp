// budget 도메인 공개 API(배럴). 금액의 단일 소유자(ADR-0001) — 업체는 정보만.
// 분담 정산은 실납부(payment.payer) 기준(ADR-0004).
export {
  useExpenses, useBudgetSummary, useSettlement, useAreaBreakdown,
  useCreateExpense, useUpdateExpense, useDeleteExpense, useCreateVendor,
  useAddOption, useDeleteOption,
  useAddPayment, useUpdatePayment, useDeletePayment, useTogglePayment,
  useSetAreaBudget, useUpdateTotalBudget,
} from './hooks';
export {
  selectExpensesWithTotals, selectBudgetSummary, selectSettlementByPayer, selectAreaBreakdown,
  todayDateString,
} from './api';
export type {
  CreateExpenseInput, UpdateExpenseInput, CreateVendorInput, OptionInput, PaymentInput,
  AddPaymentInput, UpdatePaymentInput,
} from './api';
export type {
  ExpenseWithTotal, BudgetSummary, PayerSettlement, AreaBreakdown, VendorGroup, VendorGroupLine,
} from './types';

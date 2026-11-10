import { supabase } from './supabase';
import type {
  AreaBudget, ChecklistItem, CoupleSnapshot, Expense, ExpenseOption, Payment, ScheduleEvent,
  Vendor, WeddingDateStatus,
} from '@/types/db';
import type { CreateChecklistItemInput, UpdateChecklistItemInput } from '@/features/checklist/api';
import type { CreateScheduleEventInput, UpdateScheduleEventInput } from '@/features/schedule/api';
import type {
  AddPaymentInput, CreateExpenseInput, CreateVendorInput, OptionInput, UpdateExpenseInput,
  UpdatePaymentInput,
} from '@/features/budget/api';

// 커플 데이터 접근의 유일한 통로(ADR-0003). 테이블 직접 접근 없이 RPC만 호출한다.
// 쓰기 RPC(create_*/update_*/delete_*)는 화면을 만드는 Phase에서 테이블별로 추가한다.

// 공유 코드가 무효/미존재일 때(서버가 SQLSTATE 'PT401'로 던짐) → 온보딩으로 분기하라는 신호.
export class ShareCodeInvalidError extends Error {
  constructor() {
    super('유효하지 않은 공유 코드입니다.');
    this.name = 'ShareCodeInvalidError';
  }
}

export type CreateCoupleInput = {
  groomName: string;
  brideName: string;
  weddingDate?: string | null;
  weddingDateStatus: WeddingDateStatus;
  venue?: string | null;
};

// 새 커플 생성 → 서버가 공유 코드를 발급해 반환(원문 hex).
export async function createCouple(input: CreateCoupleInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_couple', {
    p_groom_name: input.groomName,
    p_bride_name: input.brideName,
    p_wedding_date: input.weddingDate ?? null,
    p_wedding_date_status: input.weddingDateStatus,
    p_venue: input.venue ?? null,
  });
  if (error) throw error;
  return data as string;
}

// 공유 코드로 커플 전체 스냅샷 조회. 코드가 무효면 ShareCodeInvalidError.
export async function getCoupleSnapshot(shareCode: string): Promise<CoupleSnapshot> {
  const { data, error } = await supabase.rpc('get_couple_snapshot', { p_share_code: shareCode });
  if (error) {
    if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError();
    throw error;
  }
  if (!data) throw new ShareCodeInvalidError();
  return data as CoupleSnapshot;
}

// ── 체크리스트 쓰기 RPC (ADR-0003: supabase.rpc는 이 파일에만) ──
export async function createChecklistItem(
  shareCode: string, input: CreateChecklistItemInput,
): Promise<ChecklistItem> {
  const { data, error } = await supabase.rpc('create_checklist_item', {
    p_share_code: shareCode, p_area_id: input.areaId, p_title: input.title,
    p_assignee: input.assignee, p_due_date: input.dueDate ?? null, p_memo: input.memo ?? null,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ChecklistItem;
}

export async function updateChecklistItem(
  shareCode: string, input: UpdateChecklistItemInput,
): Promise<ChecklistItem> {
  const { data, error } = await supabase.rpc('update_checklist_item', {
    p_share_code: shareCode, p_id: input.id, p_title: input.title,
    p_assignee: input.assignee, p_due_date: input.dueDate ?? null, p_memo: input.memo ?? null,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ChecklistItem;
}

export async function toggleChecklistItem(
  shareCode: string, id: string, isDone: boolean,
): Promise<ChecklistItem> {
  const { data, error } = await supabase.rpc('toggle_checklist_item', {
    p_share_code: shareCode, p_id: id, p_is_done: isDone,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ChecklistItem;
}

export async function deleteChecklistItem(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_checklist_item', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}

// ── 일정 쓰기 RPC (ADR-0003: supabase.rpc는 이 파일에만) ──
export async function createScheduleEvent(
  shareCode: string, input: CreateScheduleEventInput,
): Promise<ScheduleEvent> {
  const { data, error } = await supabase.rpc('create_schedule_event', {
    p_share_code: shareCode, p_area_id: input.areaId ?? null, p_title: input.title,
    p_event_date: input.eventDate ?? null, p_event_time: input.eventTime ?? null,
    p_location: input.location ?? null, p_assignee: input.assignee ?? null, p_category: input.category,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ScheduleEvent;
}

export async function updateScheduleEvent(
  shareCode: string, input: UpdateScheduleEventInput,
): Promise<ScheduleEvent> {
  const { data, error } = await supabase.rpc('update_schedule_event', {
    p_share_code: shareCode, p_id: input.id, p_title: input.title,
    p_event_date: input.eventDate ?? null, p_event_time: input.eventTime ?? null,
    p_location: input.location ?? null, p_assignee: input.assignee ?? null, p_category: input.category,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ScheduleEvent;
}

export async function deleteScheduleEvent(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_schedule_event', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}

// ── 비용 쓰기 RPC (ADR-0003: supabase.rpc는 이 파일에만. ADR-0004: 분담=payment.payer) ──

// 지출 생성(원자적) — 옵션·납부를 jsonb 배열로 함께 넘긴다(서버가 한 트랜잭션에 insert).
export async function createExpense(shareCode: string, input: CreateExpenseInput): Promise<Expense> {
  const { data, error } = await supabase.rpc('create_expense', {
    p_share_code: shareCode, p_area_id: input.areaId, p_vendor_id: input.vendorId ?? null,
    p_title: input.title ?? null, p_base_amount: input.baseAmount,
    p_options: input.options.map((o) => ({ name: o.name, amount: o.amount })),
    p_payments: input.payments.map((p) => ({
      kind: p.kind, amount: p.amount, due_date: p.dueDate ?? null,
      payer: p.payer ?? null, is_paid: p.isPaid ?? false,
    })),
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Expense;
}

export async function updateExpense(shareCode: string, input: UpdateExpenseInput): Promise<Expense> {
  const { data, error } = await supabase.rpc('update_expense', {
    p_share_code: shareCode, p_id: input.id, p_title: input.title ?? null, p_base_amount: input.baseAmount,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Expense;
}

export async function deleteExpense(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_expense', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}

export async function createVendor(shareCode: string, input: CreateVendorInput): Promise<Vendor> {
  const { data, error } = await supabase.rpc('create_vendor', {
    p_share_code: shareCode, p_area_id: input.areaId, p_name: input.name,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Vendor;
}

export async function addExpenseOption(
  shareCode: string, expenseId: string, input: OptionInput,
): Promise<ExpenseOption> {
  const { data, error } = await supabase.rpc('add_expense_option', {
    p_share_code: shareCode, p_expense_id: expenseId, p_name: input.name, p_amount: input.amount,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as ExpenseOption;
}

export async function deleteExpenseOption(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_expense_option', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}

export async function addPayment(shareCode: string, input: AddPaymentInput): Promise<Payment> {
  const { data, error } = await supabase.rpc('add_payment', {
    p_share_code: shareCode, p_expense_id: input.expenseId, p_kind: input.kind, p_amount: input.amount,
    p_due_date: input.dueDate ?? null, p_payer: input.payer ?? null, p_is_paid: input.isPaid ?? false,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Payment;
}

export async function updatePayment(shareCode: string, input: UpdatePaymentInput): Promise<Payment> {
  const { data, error } = await supabase.rpc('update_payment', {
    p_share_code: shareCode, p_id: input.id, p_kind: input.kind, p_amount: input.amount,
    p_due_date: input.dueDate ?? null, p_payer: input.payer ?? null, p_is_paid: input.isPaid ?? false,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Payment;
}

export async function deletePayment(shareCode: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_payment', { p_share_code: shareCode, p_id: id });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}

export async function togglePaymentPaid(
  shareCode: string, id: string, isPaid: boolean,
): Promise<Payment> {
  const { data, error } = await supabase.rpc('toggle_payment_paid', {
    p_share_code: shareCode, p_id: id, p_is_paid: isPaid,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as Payment;
}

export async function setAreaBudget(
  shareCode: string, areaId: string, amount: number,
): Promise<AreaBudget> {
  const { data, error } = await supabase.rpc('set_area_budget', {
    p_share_code: shareCode, p_area_id: areaId, p_amount: amount,
  });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
  return data as AreaBudget;
}

export async function updateTotalBudget(shareCode: string, amount: number): Promise<void> {
  const { error } = await supabase.rpc('update_total_budget', { p_share_code: shareCode, p_amount: amount });
  if (error) { if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError(); throw error; }
}

// DB 데이터 모델의 TS 타입 (docs/db/ 기준). RPC 스냅샷·행 타입의 단일 출처.
// 코드값(enum)은 code-definitions.md와 1:1. 금액은 bigint지만 2인·원 단위라 number로 다룬다
// (JS 안전 정수 범위 내 — 결혼 비용 규모에서 2^53을 넘지 않는다).

export type AreaCode = 'SDM' | 'HALL' | 'INV' | 'GIFT' | 'HOME' | 'GUEST';
export type Assignee = 'ME' | 'PARTNER' | 'BOTH';
export type WeddingDateStatus = 'UNDECIDED' | 'APPROX' | 'FIXED';
export type VendorStatus = 'CANDIDATE' | 'CONTRACTED';
export type VendorRole = 'STUDIO' | 'DRESS' | 'MAKEUP';
export type EventCategory = 'EVENT' | 'IMPORTANT' | 'MILESTONE';
export type PaymentKind = 'DEPOSIT' | 'INTERIM' | 'ETC' | 'BALANCE';
export type Payer = 'ME' | 'PARTNER' | 'BOTH_FAMILY';
export type GuestSide = 'GROOM' | 'BRIDE';
export type GuestRelation = 'FAMILY' | 'FRIEND' | 'WORK' | 'ACQUAINTANCE';
export type AttendStatus = 'ATTENDING' | 'MAYBE' | 'ABSENT';
export type Origin = 'SEED' | 'USER';

// 전역 참조
export type Area = {
  id: string;
  created_at: string;
  code: AreaCode;
  name_ko: string;
  sort_order: number;
};

export type AuspiciousDay = {
  id: string;
  created_at: string;
  day: string; // YYYY-MM-DD
  note: string | null;
};

// 커플 범위
export type Couple = {
  id: string;
  created_at: string;
  share_code: string;
  groom_name: string;
  bride_name: string;
  wedding_date: string | null;
  wedding_date_status: WeddingDateStatus;
  wedding_time: string | null;
  venue: string | null;
  show_auspicious_days: boolean;
  notify_payments: boolean;
  total_budget: number; // 전체 예산(원). 영역별 예산은 AreaBudget
};

// 영역별 예산(영역당 1행, upsert). 전체 예산은 Couple.total_budget.
export type AreaBudget = {
  id: string;
  created_at: string;
  couple_id: string;
  area_id: string;
  amount: number;
};

export type ChecklistItem = {
  id: string;
  created_at: string;
  couple_id: string;
  area_id: string;
  title: string;
  assignee: Assignee;
  is_done: boolean;
  done_at: string | null;
  due_date: string | null;
  memo: string | null;
  origin: Origin;
  sort_order: number;
};

export type ScheduleEvent = {
  id: string;
  created_at: string;
  couple_id: string;
  area_id: string | null;
  title: string;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  assignee: Assignee | null;
  category: EventCategory;
  reminder_at: string | null;
  origin: Origin;
};

export type Vendor = {
  id: string;
  created_at: string;
  couple_id: string;
  area_id: string;
  name: string;
  status: VendorStatus;
  role: VendorRole | null;
  location: string | null;
  contract_date: string | null;
  quoted_price: number | null;
  memo: string | null;
};

export type Expense = {
  id: string;
  created_at: string;
  couple_id: string;
  area_id: string;
  vendor_id: string | null;
  title: string | null;
  base_amount: number;
};

export type ExpenseOption = {
  id: string;
  created_at: string;
  couple_id: string;
  expense_id: string;
  name: string;
  amount: number;
};

export type ExpenseSplit = {
  id: string;
  created_at: string;
  couple_id: string;
  expense_id: string;
  payer: Payer;
  amount: number;
};

export type Payment = {
  id: string;
  created_at: string;
  couple_id: string;
  expense_id: string;
  kind: PaymentKind;
  amount: number;
  due_date: string | null;
  payer: Payer | null; // 분담 정산 소스(ADR-0004). null=납부자 미지정(분담 집계 제외)
  is_paid: boolean;
  paid_at: string | null;
};

export type Guest = {
  id: string;
  created_at: string;
  couple_id: string;
  name: string;
  side: GuestSide;
  relation: GuestRelation;
  attend_status: AttendStatus;
  is_host: boolean;
  meal_count: number;
  gift_amount: number | null;
  memo: string | null;
};

export type Photo = {
  id: string;
  created_at: string;
  couple_id: string;
  area_id: string | null;
  storage_path: string | null;
  external_url: string | null;
  is_video: boolean;
  caption: string | null;
  taken_at: string | null;
};

// get_couple_snapshot RPC 반환 형태(커플 범위 전 테이블). area 등 전역 참조는 별도 조회.
export type CoupleSnapshot = {
  couple: Couple;
  checklist_items: ChecklistItem[];
  schedule_events: ScheduleEvent[];
  vendors: Vendor[];
  expenses: Expense[];
  expense_options: ExpenseOption[];
  expense_splits: ExpenseSplit[]; // Phase 1 비용 화면 미사용(ADR-0004) — 스냅샷엔 유지
  payments: Payment[];
  area_budgets: AreaBudget[];
  guests: Guest[];
  photos: Photo[];
};

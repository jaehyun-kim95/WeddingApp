import type { Area, Expense, ExpenseOption, Payer, VendorRole } from '@/types/db';

// 뷰/파생 타입. 비용 화면은 CoupleSnapshot을 집계해 아래 모양들로 재조합한다(ADR-0001: 지출 원장).

// 지출 1건을 "기본금액 + 옵션들 → 최종금액"으로 조합한 결과.
export type ExpenseWithTotal = {
  expense: Expense;
  options: ExpenseOption[];
  finalAmount: number; // base_amount + 옵션 amount 합
};

// 상단 예산 요약(예산/약정/잔여 + 지출 진행률). 약정=Σ최종금액, 실지출=Σ납부완료.
// 사용자 결정 2026-11-10: 메인 기준(spentRate)은 "실제 입력한 지출내역(약정) 대비 실지출"이다 —
// 예산 소비율(budgetRate)은 "예상과 실제의 차이"를 보는 참고자료일 뿐 기준이 아니다.
export type BudgetSummary = {
  totalBudget: number; // couple.total_budget
  committed: number; // 약정 = Σ 지출 최종금액(기본+옵션) — 지출내역 총합, 메인 기준의 분모
  actualSpent: number; // 실지출 = Σ 납부완료 payment.amount
  remaining: number; // 잔여 = max(0, committed − actualSpent) — 아직 못 낸 총액(과납 0 클램프)
  spentRate: number; // 메인 지표: 실지출 / committed × 100 (0~100 반올림, committed=0이면 0)
  budgetRate: number; // 참고자료: committed / totalBudget × 100 (예산 대비 약정 — 예상·실제 차이 비교용)
};

// 분담 정산 한 줄(신랑/신부/양가/미지정). 실납부 기준(ADR-0004). 미터는 중립(웜그레이).
// payer=null 행은 "미지정"(납부자 안 정한 완료 납부) — 분담 정산에서 숨기지 않고 노출한다
// (사용자 결정 2026-11-10 — 미지정 지출이 사라지지 않게).
export type PayerSettlement = {
  payer: Payer | null;
  amount: number; // Σ 납부완료 payment.amount (해당 payer, null=미지정)
  percent: number; // amount / 총납부(전체, 미지정 포함) (0~100 반올림)
};

// 업체 묶음(또는 직접 지출) 안의 금액 한 줄. isOption이면 추가금('+' 블러시).
export type VendorGroupLine = { id: string; name: string; amount: number; isOption: boolean };

// 영역 안의 지출 1건 = 업체 묶음 하나(vgroup). 기본 견적 + 옵션들 → 최종금액(예정).
// 납부/잔금은 실납부(완료 payment) 기준 파생: paid=Σ완료납부, remaining=max(0, 예정−납부).
export type VendorGroup = {
  key: string; // = expenseId
  expenseId: string; // 편집/삭제 대상
  name: string; // 업체명(vendor) 또는 직접 지출 명칭(title)
  isDirect: boolean; // 업체 미연결(직접 지출)
  role: VendorRole | null; // 스드메 역할(있으면 칩)
  finalAmount: number; // 묶음 최종금액(= 지출 예정/약정)
  paid: number; // Σ 완료 납부(해당 지출)
  remaining: number; // 잔금 = max(0, finalAmount − paid)
  lines: VendorGroupLine[]; // 기본 견적 + 옵션들
};

// 영역별 배분(영역 섹션). 소계·예산 대비·초과(테라코타).
export type AreaBreakdown = {
  area: Area;
  budget: number; // area_budget.amount (미설정이면 0)
  committed: number; // Σ 최종금액(영역 내)
  isOver: boolean; // committed > budget (budget>0일 때만)
  groups: VendorGroup[];
};

import type {
  Area, CoupleSnapshot, Expense, ExpenseOption, Payer, Payment, Vendor,
} from '@/types/db';
import { selectAreaBreakdown, selectBudgetSummary, selectSettlementByPayer } from './api';

// ── 빌더(필요한 슬라이스만 — 부분 캐스트) ──
const expense = (id: string, areaId: string, base: number, extra: Partial<Expense> = {}): Expense => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, vendor_id: null, title: id, base_amount: base, ...extra,
});
const option = (id: string, expenseId: string, amount: number): ExpenseOption => ({
  id, created_at: '', couple_id: 'c1', expense_id: expenseId, name: id, amount,
});
const payment = (
  id: string, expenseId: string, amount: number, isPaid: boolean, payer: Payer | null = null,
): Payment => ({
  id, created_at: '', couple_id: 'c1', expense_id: expenseId, kind: 'DEPOSIT', amount,
  due_date: null, payer, is_paid: isPaid, paid_at: isPaid ? '2026-01-01T00:00:00Z' : null,
});
const vendor = (id: string, name: string, areaId: string): Vendor => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, name, status: 'CONTRACTED', role: null,
  location: null, contract_date: null, quoted_price: null, memo: null,
});
const area = (id: string, sort: number): Area => ({ id, created_at: '', code: 'HALL', name_ko: id, sort_order: sort });

const snap = (p: Partial<CoupleSnapshot>, totalBudget = 0): CoupleSnapshot =>
  ({
    couple: { total_budget: totalBudget } as CoupleSnapshot['couple'],
    expenses: [], expense_options: [], expense_splits: [], payments: [], area_budgets: [], vendors: [],
    ...p,
  } as CoupleSnapshot);

describe('selectBudgetSummary', () => {
  test('빈 스냅샷 → 전부 0', () => {
    const s = selectBudgetSummary(snap({}, 0));
    expect(s).toEqual({ totalBudget: 0, committed: 0, actualSpent: 0, remaining: 0, spentRate: 0, budgetRate: 0 });
  });

  // spentRate(메인 기준) = 실지출/약정. budgetRate(참고자료) = 약정/예산. 잔여 = 약정 − 납부(미납 총액).
  test('약정=기본+옵션 합, 실지출=납부완료만, 잔여=약정−납부', () => {
    const s = selectBudgetSummary(
      snap({
        expenses: [expense('e1', 'a1', 1000)],
        expense_options: [option('o1', 'e1', 300), option('o2', 'e1', 200)], // 최종 1500
        payments: [payment('p1', 'e1', 500, true), payment('p2', 'e1', 400, false)], // 실지출 500
      }, 5000),
    );
    expect(s.committed).toBe(1500);
    expect(s.actualSpent).toBe(500);
    expect(s.remaining).toBe(1000); // 1500 − 500 (약정 − 납부, 예산과 무관)
    expect(s.spentRate).toBe(33); // 500/1500 (메인 기준)
    expect(s.budgetRate).toBe(30); // 1500/5000 (참고자료)
  });

  test('경계: 약정 0이면 잔여 0 · spentRate 0 — 예산과 무관', () => {
    const s = selectBudgetSummary(snap({}, 5000)); // 지출 없음
    expect(s.committed).toBe(0);
    expect(s.remaining).toBe(0);
    expect(s.spentRate).toBe(0);
  });

  test('경계: 완납이면 잔여 0, spentRate 100', () => {
    const s = selectBudgetSummary(
      snap({ expenses: [expense('e1', 'a1', 5000)], payments: [payment('p1', 'e1', 5000, true)] }, 5000),
    );
    expect(s.remaining).toBe(0);
    expect(s.spentRate).toBe(100);
    expect(s.budgetRate).toBe(100);
  });

  test('경계: 과납이면 잔여 0으로 클램프(음수 아님)', () => {
    const s = selectBudgetSummary(
      snap({ expenses: [expense('e1', 'a1', 1000)], payments: [payment('p1', 'e1', 1500, true)] }, 5000),
    );
    expect(s.committed).toBe(1000);
    expect(s.actualSpent).toBe(1500);
    expect(s.remaining).toBe(0); // max(0, 1000 − 1500)
  });

  test('경계: 예산 0이면 budgetRate 0, spentRate는 예산과 무관하게 계산', () => {
    const s = selectBudgetSummary(
      snap({ expenses: [expense('e1', 'a1', 1000)], payments: [payment('p1', 'e1', 1000, true)] }, 0),
    );
    expect(s.budgetRate).toBe(0);
    expect(s.spentRate).toBe(100);
    expect(s.remaining).toBe(0); // 1000 − 1000
  });
});

describe('selectSettlementByPayer', () => {
  test('항상 4행(신랑/신부/양가/미지정 순) 반환 — 빈 스냅샷은 전부 0', () => {
    const rows = selectSettlementByPayer(snap({}));
    expect(rows.map((r) => r.payer)).toEqual(['ME', 'PARTNER', 'BOTH_FAMILY', null]);
    expect(rows.every((r) => r.amount === 0 && r.percent === 0)).toBe(true);
  });

  test('납부완료만 집계, 미납은 제외하되 payer null(미지정)은 별도 행으로 포함', () => {
    const rows = selectSettlementByPayer(
      snap({
        payments: [
          payment('p1', 'e1', 600, true, 'ME'),
          payment('p2', 'e1', 400, true, 'PARTNER'),
          payment('p3', 'e1', 999, false, 'ME'), // 미납 → 제외
          payment('p4', 'e1', 200, true, null), // 미지정 → 포함(숨기지 않음)
        ],
      }),
    );
    const byPayer = new Map(rows.map((r) => [r.payer, r]));
    expect(byPayer.get('ME')?.amount).toBe(600);
    expect(byPayer.get('PARTNER')?.amount).toBe(400);
    expect(byPayer.get('BOTH_FAMILY')?.amount).toBe(0);
    expect(byPayer.get(null)?.amount).toBe(200); // 미지정 행
    // percent는 총납부(1200, 미지정 포함) 기준
    expect(byPayer.get('ME')?.percent).toBe(50);
    expect(byPayer.get('PARTNER')?.percent).toBe(33);
    expect(byPayer.get(null)?.percent).toBe(17);
  });
});

describe('selectAreaBreakdown', () => {
  const areas = [area('a1', 1), area('a2', 2)];

  test('area sort_order 순으로 모든 영역 반환(지출 없는 영역도)', () => {
    const rows = selectAreaBreakdown(snap({}), [area('a2', 2), area('a1', 1)]);
    expect(rows.map((r) => r.area.id)).toEqual(['a1', 'a2']);
    expect(rows[0].groups).toEqual([]);
    expect(rows[0].committed).toBe(0);
  });

  test('업체 연결 지출은 vendor.name, 직접 지출은 title로 묶음명', () => {
    const rows = selectAreaBreakdown(
      snap({
        expenses: [
          expense('e1', 'a1', 1000, { vendor_id: 'v1', title: null }),
          expense('e2', 'a1', 500, { vendor_id: null, title: '입주청소' }),
        ],
        vendors: [vendor('v1', '그랜드홀', 'a1')],
      }),
      areas,
    );
    const g = rows[0].groups;
    expect(g.map((x) => x.name)).toEqual(['그랜드홀', '입주청소']);
    expect(g[0].isDirect).toBe(false);
    expect(g[1].isDirect).toBe(true);
  });

  test('옵션이 최종금액·소계에 더해진다', () => {
    const rows = selectAreaBreakdown(
      snap({
        expenses: [expense('e1', 'a1', 1000)],
        expense_options: [option('o1', 'e1', 300)],
      }),
      areas,
    );
    expect(rows[0].groups[0].finalAmount).toBe(1300);
    expect(rows[0].groups[0].lines).toHaveLength(2); // 기본 견적 + 옵션 1
    expect(rows[0].committed).toBe(1300);
  });

  test('초과 플래그: 소계 > 예산일 때만 true(strict)', () => {
    const base = (budgetAmount: number, spend: number) =>
      selectAreaBreakdown(
        snap({
          expenses: [expense('e1', 'a1', spend)],
          area_budgets: [{ id: 'b1', created_at: '', couple_id: 'c1', area_id: 'a1', amount: budgetAmount }],
        }),
        areas,
      )[0];
    expect(base(1000, 1200).isOver).toBe(true); // 초과
    expect(base(1000, 1000).isOver).toBe(false); // 같음 → 초과 아님
    expect(base(1000, 800).isOver).toBe(false); // 미만
  });

  test('경계: 예산 미설정(0)이면 지출이 있어도 초과 아님', () => {
    const row = selectAreaBreakdown(snap({ expenses: [expense('e1', 'a1', 9999)] }), areas)[0];
    expect(row.budget).toBe(0);
    expect(row.isOver).toBe(false);
  });

  // 잔금 = 예정(약정) − 완료 납부. 과납이면 0 클램프. 미완료 납부는 제외.
  test('납부/잔금: 미납이면 paid 0 · remaining = 예정', () => {
    const g = selectAreaBreakdown(snap({ expenses: [expense('e1', 'a1', 250)] }), areas)[0].groups[0];
    expect(g.finalAmount).toBe(250);
    expect(g.paid).toBe(0);
    expect(g.remaining).toBe(250);
  });

  test('납부/잔금: 부분 납부(완료만 집계, 미완료 제외)', () => {
    const g = selectAreaBreakdown(
      snap({
        expenses: [expense('e1', 'a1', 250)],
        payments: [payment('p1', 'e1', 75, true), payment('p2', 'e1', 100, false)], // 완료 75만
      }),
      areas,
    )[0].groups[0];
    expect(g.paid).toBe(75);
    expect(g.remaining).toBe(175); // 250 − 75
  });

  test('납부/잔금: 옵션 포함 예정 기준으로 잔금 계산', () => {
    const g = selectAreaBreakdown(
      snap({
        expenses: [expense('e1', 'a1', 1000)],
        expense_options: [option('o1', 'e1', 300)], // 예정 1300
        payments: [payment('p1', 'e1', 500, true)],
      }),
      areas,
    )[0].groups[0];
    expect(g.finalAmount).toBe(1300);
    expect(g.remaining).toBe(800);
  });

  test('납부/잔금: 완납이면 remaining 0, 과납이면 0 클램프(음수 아님)', () => {
    const full = selectAreaBreakdown(
      snap({ expenses: [expense('e1', 'a1', 250)], payments: [payment('p1', 'e1', 250, true)] }),
      areas,
    )[0].groups[0];
    expect(full.remaining).toBe(0);

    const over = selectAreaBreakdown(
      snap({ expenses: [expense('e1', 'a1', 250)], payments: [payment('p1', 'e1', 300, true)] }),
      areas,
    )[0].groups[0];
    expect(over.paid).toBe(300);
    expect(over.remaining).toBe(0); // 음수 아님
  });
});

import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fab, PageHead, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useCouple, useCoupleSnapshot } from '@/features/couple';
import {
  todayDateString,
  useAddOption, useAddPayment, useAreaBreakdown, useBudgetSummary, useCreateExpense,
  useCreateVendor, useDeleteExpense, useDeleteOption, useDeletePayment, useSetAreaBudget,
  useSettlement, useTogglePayment, useUpdateExpense, useUpdateTotalBudget,
} from '@/features/budget';
import { AreaBreakdown } from '@/features/budget/components/area-breakdown';
import { BudgetSummary } from '@/features/budget/components/budget-summary';
import { ExpenseDetail, type ExpenseDetailView } from '@/features/budget/components/expense-detail';
import { ExpenseForm, type ExpenseFormValue } from '@/features/budget/components/expense-form';
import { Settlement } from '@/features/budget/components/settlement';
import { useAreas } from '@/hooks/use-areas';

// 예식일까지 D-day 문자열(미정이면 null). 도메인 독립 — 간단한 날짜 차이만 인라인 계산.
function ddayLabel(weddingDate: string | null, status: string, today: string): string | null {
  if (status === 'UNDECIDED' || !weddingDate) return null;
  const diff = Math.round(
    (new Date(`${weddingDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000,
  );
  if (diff === 0) return 'D-Day';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

export default function BudgetScreen() {
  const { data: snapshot } = useCoupleSnapshot();
  const { data: couple } = useCouple();
  const { data: areas = [] } = useAreas();
  const { data: summary } = useBudgetSummary();
  const { data: settlement = [] } = useSettlement();
  const { data: breakdown = [] } = useAreaBreakdown(areas);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const createVendor = useCreateVendor();
  const addOption = useAddOption();
  const deleteOption = useDeleteOption();
  const addPayment = useAddPayment();
  const deletePayment = useDeletePayment();
  const togglePayment = useTogglePayment();
  const setAreaBudget = useSetAreaBudget();
  const updateTotal = useUpdateTotalBudget();

  const today = todayDateString();
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  // 상세 뷰는 스냅샷에서 즉석 조합(삭제되면 null → 모달 닫힘).
  const detailView: ExpenseDetailView | null = useMemo(() => {
    if (!detailId || !snapshot) return null;
    const expense = snapshot.expenses.find((e) => e.id === detailId);
    if (!expense) return null;
    const vendor = expense.vendor_id ? snapshot.vendors.find((v) => v.id === expense.vendor_id) : null;
    return {
      expense,
      options: snapshot.expense_options.filter((o) => o.expense_id === detailId),
      payments: snapshot.payments.filter((p) => p.expense_id === detailId),
      name: vendor?.name ?? expense.title ?? '지출',
    };
  }, [detailId, snapshot]);

  const openAdd = () => { setFormKey((k) => k + 1); setFormOpen(true); };

  const submitForm = async (v: ExpenseFormValue) => {
    setFormOpen(false);
    let vendorId: string | null = v.vendorId;
    if (v.vendorMode === 'new' && v.vendorName) {
      const vendor = await createVendor.mutateAsync({ areaId: v.areaId, name: v.vendorName });
      vendorId = (vendor as { id: string }).id;
    }
    createExpense.mutate({
      areaId: v.areaId,
      vendorId: v.vendorMode === 'direct' ? null : vendorId,
      title: v.vendorMode === 'direct' ? v.title : null,
      baseAmount: v.baseAmount,
      options: v.options,
      payments: v.payments,
    });
  };

  const hasExpenses = (snapshot?.expenses.length ?? 0) > 0;
  const dday = couple ? ddayLabel(couple.wedding_date, couple.wedding_date_status, today) : null;
  const sub = couple
    ? `${couple.groom_name} & ${couple.bride_name}${couple.wedding_date ? ` · ${couple.wedding_date}` : ''}`
    : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: layout.tabBarHeight + 80 }}>
        <PageHead title="비용" sub={sub} dday={dday ?? undefined} />

        {summary ? (
          <View style={{ marginTop: spacing.lg }}>
            <BudgetSummary summary={summary} onEditTotal={(won) => updateTotal.mutate({ amount: won })} />
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xxxl }}>
          <Settlement rows={settlement} />
        </View>

        <View style={{ marginTop: spacing.md }}>
          {!hasExpenses ? (
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.sm }}>
              아직 지출이 없습니다. 아래 ‘지출 추가’로 시작하세요. 영역 예산은 각 영역의 금액을 탭해 설정합니다.
            </Text>
          ) : null}
          {breakdown.map((row) => (
            <AreaBreakdown
              key={row.area.id}
              row={row}
              onEditBudget={(areaId, won) => setAreaBudget.mutate({ areaId, amount: won })}
              onEditExpense={(expenseId) => setDetailId(expenseId)}
            />
          ))}
        </View>
      </ScrollView>

      <Fab label="지출 추가" onPress={openAdd} />

      <ExpenseForm
        key={formKey}
        visible={formOpen}
        areas={areas}
        vendors={snapshot?.vendors ?? []}
        defaultAreaId={null}
        onSubmit={submitForm}
        onClose={() => setFormOpen(false)}
      />

      <ExpenseDetail
        visible={detailId !== null}
        view={detailView}
        onUpdateBase={(won) => detailView && updateExpense.mutate({ id: detailView.expense.id, title: detailView.expense.title, baseAmount: won })}
        onAddOption={(name, won) => detailView && addOption.mutate({ expenseId: detailView.expense.id, input: { name, amount: won } })}
        onDeleteOption={(id) => deleteOption.mutate({ id })}
        onAddPayment={(kind, won, payer) => detailView && addPayment.mutate({ expenseId: detailView.expense.id, kind, amount: won, payer })}
        onDeletePayment={(id) => deletePayment.mutate({ id })}
        onTogglePayment={(id, isPaid) => togglePayment.mutate({ id, isPaid })}
        onDeleteExpense={() => { if (detailView) deleteExpense.mutate({ id: detailView.expense.id }); setDetailId(null); }}
        onClose={() => setDetailId(null)}
      />
    </SafeAreaView>
  );
}

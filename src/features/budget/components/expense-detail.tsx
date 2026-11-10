import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Chip, Segmented, Switch, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { formatMan, manToWon } from '@/lib/money';
import type { Expense, ExpenseOption, Payer, Payment, PaymentKind } from '@/types/db';
import { AmountEditModal } from './amount-edit-modal';

// 잔금(BALANCE)은 계산 표기로 바뀌어 종류에서 뺐다(0005). 남은 데이터 하위호환용 라벨만 유지.
const KIND_LABEL: Record<PaymentKind, string> = { DEPOSIT: '예약금', INTERIM: '중도금', ETC: '기타', BALANCE: '잔금' };
const KIND_OPTS = [
  { key: 'DEPOSIT', label: '예약금' }, { key: 'INTERIM', label: '중도금' }, { key: 'ETC', label: '기타' },
] as const;
// "나/애인"은 보는 사람에 따라 바뀌는 상대적 기준이라 혼동을 줘서 "신랑/신부"로 표시한다(DB 값은 불변).
const PAYER_LABEL: Record<Payer, string> = { ME: '신랑', PARTNER: '신부', BOTH_FAMILY: '양가' };
const PAYER_OPTS: { key: Payer | 'NONE'; label: string }[] = [
  { key: 'ME', label: '신랑' }, { key: 'PARTNER', label: '신부' },
  { key: 'BOTH_FAMILY', label: '양가' }, { key: 'NONE', label: '미지정' },
];

export type ExpenseDetailView = { expense: Expense; options: ExpenseOption[]; payments: Payment[]; name: string };

// 지출 상세/편집 — 기본금액 수정, 옵션·납부 추가/삭제, 납부 완료 토글, 지출 삭제.
// 각 동작은 즉시 뮤테이션(낙관적). 제목 수정은 생성 시 확정으로 두고 Phase 1에선 금액 중심.
export function ExpenseDetail({
  visible, view, onUpdateBase, onAddOption, onDeleteOption, onAddPayment, onDeletePayment,
  onTogglePayment, onDeleteExpense, onClose,
}: {
  visible: boolean;
  view: ExpenseDetailView | null;
  onUpdateBase: (won: number) => void;
  onAddOption: (name: string, won: number) => void;
  onDeleteOption: (id: string) => void;
  onAddPayment: (kind: PaymentKind, won: number, payer: Payer | null) => void;
  onDeletePayment: (id: string) => void;
  onTogglePayment: (id: string, isPaid: boolean) => void;
  onDeleteExpense: () => void;
  onClose: () => void;
}) {
  const [editBase, setEditBase] = useState(false);
  const [optName, setOptName] = useState('');
  const [optMan, setOptMan] = useState('');
  const [payKind, setPayKind] = useState<PaymentKind>('DEPOSIT');
  const [payMan, setPayMan] = useState('');
  const [payPayer, setPayPayer] = useState<Payer | null>(null);

  if (!view) return null;
  const { expense, options, payments, name } = view;
  const num = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;
  const finalAmount = options.reduce((sum, o) => sum + o.amount, expense.base_amount);
  const paid = payments.reduce((sum, p) => (p.is_paid ? sum + p.amount : sum), 0);
  const remaining = Math.max(0, finalAmount - paid);

  const addOption = () => {
    if (!optName.trim() || num(optMan) <= 0) return;
    onAddOption(optName.trim(), manToWon(num(optMan)));
    setOptName(''); setOptMan('');
  };
  const addPayment = () => {
    if (num(payMan) <= 0) return;
    onAddPayment(payKind, manToWon(num(payMan)), payPayer);
    setPayMan(''); setPayPayer(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ maxHeight: '88%', backgroundColor: colors.ground, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <ScrollView contentContainerStyle={{ padding: layout.screenPadding, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="title" style={{ flex: 1 }}>{name}</Text>
            <Text variant="stat" tabularNums>{formatMan(finalAmount)}</Text>
          </View>

          {/* 기본 견적(탭 수정) */}
          <Pressable onPress={() => setEditBase(true)} accessibilityRole="button" style={rowStyle}>
            <Text variant="bodySm" color="inkMuted">기본 견적 · 탭하여 수정</Text>
            <Text variant="bodySm" tabularNums>{formatMan(expense.base_amount)}</Text>
          </Pressable>

          {/* 옵션 */}
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodySm" color="inkMuted">옵션 (추가금)</Text>
            {options.map((o) => (
              <View key={o.id} style={rowStyle}>
                <Text variant="meta" color="blushInk" style={{ flex: 1 }}>+ {o.name}</Text>
                <Text variant="meta" color="blushInk" tabularNums>{formatMan(o.amount)}</Text>
                <Pressable onPress={() => onDeleteOption(o.id)} accessibilityLabel="옵션 삭제" style={{ paddingLeft: spacing.sm }}><Text variant="meta" color="inkMuted">✕</Text></Pressable>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <TextInput value={optName} onChangeText={setOptName} placeholder="옵션명" placeholderTextColor={colors.inkFaint} style={[inputStyle, { flex: 1 }]} />
              <TextInput value={optMan} onChangeText={(t) => setOptMan(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="만원" placeholderTextColor={colors.inkFaint} style={[inputStyle, { width: 80, textAlign: 'right' }]} />
              <Button variant="ghost" label="추가" onPress={addOption} />
            </View>
          </View>

          {/* 납부 */}
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodySm" color="inkMuted">납부</Text>
            {payments.map((p) => (
              <View key={p.id} style={[rowStyle, { gap: spacing.sm }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySm" tabularNums>
                    {KIND_LABEL[p.kind]} · {formatMan(p.amount)}
                    {p.payer ? ` · ${PAYER_LABEL[p.payer]}` : ''}
                  </Text>
                  {p.due_date ? <Text variant="caption" color="inkMuted">{p.due_date}</Text> : null}
                </View>
                <Switch value={p.is_paid} onValueChange={(v) => onTogglePayment(p.id, v)} />
                <Pressable onPress={() => onDeletePayment(p.id)} accessibilityLabel="납부 삭제" style={{ paddingLeft: spacing.xs }}><Text variant="meta" color="inkMuted">✕</Text></Pressable>
              </View>
            ))}

            {/* 잔금 자동 표기(예정 − 납부). 수동 입력 아님. */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.lineStrong }}>
              <Text variant="caption" color="inkMuted">잔금 (예정 {formatMan(finalAmount)} − 납부 {formatMan(paid)})</Text>
              <Text variant="titleSm" color="blushInk" tabularNums>{formatMan(remaining)}</Text>
            </View>

            {/* 납부 추가 행 */}
            <View style={{ gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md }}>
              <Segmented options={KIND_OPTS.map((k) => ({ key: k.key, label: k.label }))} value={payKind} onChange={(k) => setPayKind(k as PaymentKind)} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <TextInput value={payMan} onChangeText={(t) => setPayMan(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="금액(만원)" placeholderTextColor={colors.inkFaint} style={[inputStyle, { flex: 1, textAlign: 'right' }]} />
                <Button variant="ghost" label="납부 추가" onPress={addPayment} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {PAYER_OPTS.map((po) => {
                  const sel = (po.key === 'NONE' ? null : po.key) === payPayer;
                  return (
                    <Pressable key={po.key} onPress={() => setPayPayer(po.key === 'NONE' ? null : (po.key as Payer))}>
                      <Chip variant={sel ? 'area' : 'ghost'} label={po.label} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <Button variant="ghost" label="지출 삭제" onPress={onDeleteExpense} />
            <Button label="닫기" onPress={onClose} />
          </View>
        </ScrollView>
      </View>

      <AmountEditModal
        visible={editBase}
        title="기본 견적"
        initialWon={expense.base_amount}
        onSubmit={(won) => { setEditBase(false); onUpdateBase(won); }}
        onClose={() => setEditBase(false)}
      />
    </Modal>
  );
}

const rowStyle = {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line,
} as const;

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;

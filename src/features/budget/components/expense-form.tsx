import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Chip, DateField, Segmented, Switch, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { parseManInput, sanitizeManInput } from '@/lib/money';
import type { Area, Payer, PaymentKind, Vendor } from '@/types/db';

// 업체 선택 모드: 기존 업체 / 새 업체(이름 입력) / 직접 지출(업체 없음, 명칭 입력).
type VendorMode = 'existing' | 'new' | 'direct';
type OptionRow = { name: string; amountMan: string };
type PaymentRow = { kind: PaymentKind; amountMan: string; payer: Payer | null; dueDate: string | null; isPaid: boolean };

// 생성 폼이 산출하는 값(만원 입력은 이미 원으로 환산됨). 업체는 모드에 따라 분기.
export type ExpenseFormValue = {
  areaId: string;
  vendorMode: VendorMode;
  vendorId: string | null;
  vendorName: string;
  title: string;
  baseAmount: number;
  options: { name: string; amount: number }[];
  payments: { kind: PaymentKind; amount: number; dueDate: string | null; payer: Payer | null; isPaid: boolean }[];
};

const KIND_OPTS: { key: PaymentKind; label: string }[] = [
  { key: 'DEPOSIT', label: '예약금' }, { key: 'INTERIM', label: '중도금' }, { key: 'ETC', label: '기타' },
];
// "나/애인"은 보는 사람에 따라 바뀌는 상대적 기준이라 혼동을 줘서 "신랑/신부"로 표시한다(DB 값은 불변).
const PAYER_OPTS: { key: Payer | 'NONE'; label: string }[] = [
  { key: 'ME', label: '신랑' }, { key: 'PARTNER', label: '신부' },
  { key: 'BOTH_FAMILY', label: '양가' }, { key: 'NONE', label: '미지정' },
];

// 지출 추가(생성) 전용 단일 폼 — 기본/옵션/납부 섹션 분할, 원자적 저장(사용자 결정 2026-11-10).
// 편집·납부 토글은 ExpenseDetail에서 한다(여긴 생성만).
export function ExpenseForm({
  visible, areas, vendors, defaultAreaId, onSubmit, onClose,
}: {
  visible: boolean;
  areas: Area[];
  vendors: Vendor[];
  defaultAreaId: string | null;
  onSubmit: (v: ExpenseFormValue) => void;
  onClose: () => void;
}) {
  const [areaId, setAreaId] = useState(defaultAreaId ?? areas[0]?.id ?? '');
  const [vendorMode, setVendorMode] = useState<VendorMode>('direct');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [title, setTitle] = useState('');
  const [baseMan, setBaseMan] = useState('');
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const areaVendors = vendors.filter((v) => v.area_id === areaId);

  const canSave =
    areaId.length > 0 &&
    (vendorMode === 'existing'
      ? !!vendorId
      : vendorMode === 'new'
        ? vendorName.trim().length > 0
        : title.trim().length > 0);

  const submit = () => {
    onSubmit({
      areaId, vendorMode, vendorId: vendorMode === 'existing' ? vendorId : null,
      vendorName: vendorName.trim(), title: title.trim(), baseAmount: parseManInput(baseMan),
      options: options
        .filter((o) => o.name.trim() && parseManInput(o.amountMan) > 0)
        .map((o) => ({ name: o.name.trim(), amount: parseManInput(o.amountMan) })),
      payments: payments
        .filter((p) => parseManInput(p.amountMan) > 0)
        .map((p) => ({
          kind: p.kind, amount: parseManInput(p.amountMan), dueDate: p.dueDate,
          payer: p.payer, isPaid: p.isPaid,
        })),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ maxHeight: '88%', backgroundColor: colors.ground, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <ScrollView contentContainerStyle={{ padding: layout.screenPadding, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text variant="title">지출 추가</Text>

          {/* 영역 */}
          <Field label="영역">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {areas.map((a) => (
                <Pressable key={a.id} onPress={() => { setAreaId(a.id); setVendorId(null); }}>
                  <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
                </Pressable>
              ))}
            </View>
          </Field>

          {/* 업체 */}
          <Field label="업체">
            <Segmented
              options={[{ key: 'direct', label: '직접 지출' }, { key: 'existing', label: '기존 업체' }, { key: 'new', label: '새 업체' }]}
              value={vendorMode}
              onChange={(k) => setVendorMode(k as VendorMode)}
            />
            {vendorMode === 'existing' ? (
              areaVendors.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                  {areaVendors.map((v) => (
                    <Pressable key={v.id} onPress={() => setVendorId(v.id)}>
                      <Chip variant={vendorId === v.id ? 'area' : 'ghost'} label={v.name} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.sm }}>이 영역에 등록된 업체가 없습니다. ‘새 업체’로 추가하세요.</Text>
              )
            ) : null}
            {vendorMode === 'new' ? (
              <TextInput value={vendorName} onChangeText={setVendorName} placeholder="새 업체명" placeholderTextColor={colors.inkFaint} style={[inputStyle, { marginTop: spacing.sm }]} />
            ) : null}
            {vendorMode === 'direct' ? (
              <TextInput value={title} onChangeText={setTitle} placeholder="지출 명칭 (예: 입주 청소)" placeholderTextColor={colors.inkFaint} style={[inputStyle, { marginTop: spacing.sm }]} />
            ) : null}
          </Field>

          {/* 기본 견적 */}
          <Field label="기본 견적">
            <AmountInput value={baseMan} onChange={setBaseMan} />
          </Field>

          {/* 옵션 */}
          <Field label="옵션 (추가금)">
            {options.map((o, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm }}>
                <TextInput value={o.name} onChangeText={(t) => setOptions((rows) => rows.map((r, j) => (j === i ? { ...r, name: t } : r)))} placeholder="옵션명" placeholderTextColor={colors.inkFaint} style={[inputStyle, { flex: 1 }]} />
                <View style={{ width: 110 }}><AmountInput value={o.amountMan} onChange={(t) => setOptions((rows) => rows.map((r, j) => (j === i ? { ...r, amountMan: t } : r)))} /></View>
                <Pressable onPress={() => setOptions((rows) => rows.filter((_, j) => j !== i))} accessibilityLabel="옵션 삭제"><Text variant="body" color="inkMuted">✕</Text></Pressable>
              </View>
            ))}
            <Button variant="ghost" label="옵션 추가" onPress={() => setOptions((rows) => [...rows, { name: '', amountMan: '' }])} />
          </Field>

          {/* 납부 */}
          <Field label="납부 (실제 낸 돈 — 잔금은 자동 계산)">
            {payments.map((p, i) => (
              <View key={i} style={{ gap: spacing.sm, marginBottom: spacing.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Segmented options={KIND_OPTS.map((k) => ({ key: k.key, label: k.label }))} value={p.kind} onChange={(k) => setPayments((rows) => rows.map((r, j) => (j === i ? { ...r, kind: k as PaymentKind } : r)))} />
                  </View>
                  <Pressable onPress={() => setPayments((rows) => rows.filter((_, j) => j !== i))} accessibilityLabel="납부 삭제" style={{ paddingLeft: spacing.sm }}><Text variant="body" color="inkMuted">✕</Text></Pressable>
                </View>
                <AmountInput value={p.amountMan} onChange={(t) => setPayments((rows) => rows.map((r, j) => (j === i ? { ...r, amountMan: t } : r)))} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {PAYER_OPTS.map((po) => {
                    const sel = (po.key === 'NONE' ? null : po.key) === p.payer;
                    return (
                      <Pressable key={po.key} onPress={() => setPayments((rows) => rows.map((r, j) => (j === i ? { ...r, payer: po.key === 'NONE' ? null : (po.key as Payer) } : r)))}>
                        <Chip variant={sel ? 'area' : 'ghost'} label={po.label} />
                      </Pressable>
                    );
                  })}
                </View>
                <DateField value={p.dueDate} onChange={(d) => setPayments((rows) => rows.map((r, j) => (j === i ? { ...r, dueDate: d } : r)))} placeholder="납부 예정일 (선택)" />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="bodySm" color="inkMuted">납부 완료</Text>
                  <Switch value={p.isPaid} onValueChange={(v) => setPayments((rows) => rows.map((r, j) => (j === i ? { ...r, isPaid: v } : r)))} />
                </View>
              </View>
            ))}
            <Button variant="ghost" label="납부 추가" onPress={() => setPayments((rows) => [...rows, { kind: 'DEPOSIT', amountMan: '', payer: null, dueDate: null, isPaid: false }])} />
          </Field>

          <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end', marginTop: spacing.sm }}>
            <Button variant="ghost" label="취소" onPress={onClose} />
            <Button label="저장" onPress={submit} disabled={!canSave} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="bodySm" color="inkMuted">{label}</Text>
      {children}
    </View>
  );
}

// 만원 단위 금액 입력(우측 정렬 + '만원' 접미).
function AmountInput({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <TextInput value={value} onChangeText={(t) => onChange(sanitizeManInput(t))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.inkFaint} style={[inputStyle, { flex: 1, textAlign: 'right' }]} />
      <Text variant="caption" color="inkMuted">만원</Text>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;

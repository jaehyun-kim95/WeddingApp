import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Chip, DateField, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { parseManInput, sanitizeManInput, wonToMan } from '@/lib/money';
import type { Area, Vendor, VendorRole, VendorStatus } from '@/types/db';
import { ROLE_LABEL } from '../api';

export type VendorFormValue = {
  areaId: string;
  name: string;
  status: VendorStatus;
  role: VendorRole | null;
  location: string | null;
  contractDate: string | null;
  quotedPrice: number | null;
  memo: string | null;
};

const ROLE_OPTS: (VendorRole | null)[] = ['STUDIO', 'DRESS', 'MAKEUP', null];

// 추가(후보)/수정/상태전환 공용 모달. editing이 있으면 수정 모드 — 영역은 생성 시 고정(체크리스트
// 관례), 상태 전환은 "저장"과 분리된 명시적 버튼(계약 확정 / 후보로 되돌리기)으로만 일어난다
// (브레인스토밍 2026-11-12 결정 — 전용 토글 없음).
export function VendorForm({
  visible, areas, editing, defaultAreaId, onSubmit, onDelete, onClose,
}: {
  visible: boolean;
  areas: Area[];
  editing: Vendor | null;
  defaultAreaId: string | null;
  onSubmit: (v: VendorFormValue) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [areaId, setAreaId] = useState(editing?.area_id ?? defaultAreaId ?? areas[0]?.id ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [role, setRole] = useState<VendorRole | null>(editing?.role ?? null);
  const [location, setLocation] = useState(editing?.location ?? '');
  const [contractDate, setContractDate] = useState<string | null>(editing?.contract_date ?? null);
  const [quotedMan, setQuotedMan] = useState(
    editing?.quoted_price != null ? String(wonToMan(editing.quoted_price)) : '',
  );
  const [memo, setMemo] = useState(editing?.memo ?? '');

  const isSdm = areas.find((a) => a.id === areaId)?.code === 'SDM';
  const canSave = name.trim().length > 0 && areaId.length > 0;
  const canContract = canSave && !!contractDate;
  const isContracted = editing?.status === 'CONTRACTED';

  const submit = (status: VendorStatus) => {
    onSubmit({
      areaId, name: name.trim(), status, role: isSdm ? role : null,
      location: location.trim() ? location.trim() : null,
      contractDate, quotedPrice: quotedMan.trim() ? parseManInput(quotedMan) : null,
      memo: memo.trim() ? memo.trim() : null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ maxHeight: '88%', backgroundColor: colors.ground, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <ScrollView contentContainerStyle={{ padding: layout.screenPadding, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text variant="title">{editing ? '업체 수정' : '업체 추가(후보)'}</Text>

          <Field label="영역">
            {editing ? (
              <Chip variant="area" label={areas.find((a) => a.id === areaId)?.name_ko ?? ''} />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {areas.map((a) => (
                  <Pressable key={a.id} onPress={() => { setAreaId(a.id); setRole(null); }}>
                    <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          {isSdm ? (
            <Field label="역할">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {ROLE_OPTS.map((r) => (
                  <Pressable key={r ?? 'none'} onPress={() => setRole(r)}>
                    <Chip variant={role === r ? 'area' : 'ghost'} label={r ? ROLE_LABEL[r] : '미지정'} />
                  </Pressable>
                ))}
              </View>
            </Field>
          ) : null}

          <TextInput
            value={name} onChangeText={setName} placeholder="업체명" placeholderTextColor={colors.inkFaint}
            style={inputStyle}
          />
          <TextInput
            value={location} onChangeText={setLocation} placeholder="위치 (선택)" placeholderTextColor={colors.inkFaint}
            style={inputStyle}
          />

          <Field label="계약 견적(만원, 참고값 — 금액 소스 아님)">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <TextInput
                value={quotedMan} onChangeText={(t) => setQuotedMan(sanitizeManInput(t))}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.inkFaint}
                style={[inputStyle, { flex: 1, textAlign: 'right' }]}
              />
              <Text variant="caption" color="inkMuted">만원</Text>
            </View>
          </Field>

          <Field label="계약일">
            <DateField value={contractDate} onChange={setContractDate} placeholder="계약일 (선택)" />
          </Field>

          <TextInput
            value={memo} onChangeText={setMemo} placeholder="메모 (선택)" placeholderTextColor={colors.inkFaint}
            multiline style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-end' }}>
            {editing && onDelete ? <Button variant="ghost" label="삭제" onPress={onDelete} /> : null}
            <View style={{ flex: 1 }} />
            <Button variant="ghost" label="취소" onPress={onClose} />
            {!editing ? (
              <Button label="추가" onPress={() => submit('CANDIDATE')} disabled={!canSave} />
            ) : isContracted ? (
              <>
                <Button variant="ghost" label="후보로 되돌리기" onPress={() => submit('CANDIDATE')} disabled={!canSave} />
                <Button label="저장" onPress={() => submit('CONTRACTED')} disabled={!canSave} />
              </>
            ) : (
              <>
                <Button variant="ghost" label="계약 확정" onPress={() => submit('CONTRACTED')} disabled={!canContract} />
                <Button label="저장" onPress={() => submit('CANDIDATE')} disabled={!canSave} />
              </>
            )}
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

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;

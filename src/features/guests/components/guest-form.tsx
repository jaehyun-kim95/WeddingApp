import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Segmented, Switch, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { parseManInput, sanitizeManInput, wonToMan } from '@/lib/money';
import type { AttendStatus, Guest, GuestRelation, GuestSide } from '@/types/db';
import { ATTEND_LABEL, RELATION_LABEL, RELATION_ORDER, SIDE_LABEL, SIDE_ORDER } from '../api';
import type { CreateGuestInput } from '../api';

export type GuestFormValue = CreateGuestInput;

const ATTEND_ORDER: AttendStatus[] = ['ATTENDING', 'MAYBE', 'ABSENT'];

// 추가/수정 공용 모달(checklist-form.tsx 패턴). editing이 있으면 수정 모드.
// 축의금은 만원 단위 입력 → manToWon 변환, 비우면 null(미접수).
export function GuestForm({
  visible, editing, onSubmit, onDelete, onClose,
}: {
  visible: boolean;
  editing: Guest | null;
  onSubmit: (v: GuestFormValue) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [side, setSide] = useState<GuestSide>(editing?.side ?? 'GROOM');
  const [relation, setRelation] = useState<GuestRelation>(editing?.relation ?? 'FAMILY');
  const [attendStatus, setAttendStatus] = useState<AttendStatus>(editing?.attend_status ?? 'ATTENDING');
  const [isHost, setIsHost] = useState(editing?.is_host ?? false);
  const [mealCount, setMealCount] = useState(String(editing?.meal_count ?? 1));
  const [giftMan, setGiftMan] = useState(
    editing?.gift_amount != null ? String(wonToMan(editing.gift_amount)) : '',
  );
  const [memo, setMemo] = useState(editing?.memo ?? '');

  const canSave = name.trim().length > 0;

  const submit = () => {
    const mealN = Number(mealCount.replace(/[^0-9]/g, ''));
    onSubmit({
      name: name.trim(),
      side,
      relation,
      attendStatus,
      isHost,
      mealCount: Number.isFinite(mealN) && mealN > 0 ? mealN : 1,
      giftAmount: giftMan.trim() ? parseManInput(giftMan) : null,
      memo: memo.trim() ? memo.trim() : null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ maxHeight: '88%', backgroundColor: colors.ground, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <ScrollView contentContainerStyle={{ padding: layout.screenPadding, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text variant="title">{editing ? '하객 수정' : '하객 추가'}</Text>

        <TextInput
          value={name} onChangeText={setName} placeholder="이름" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />

        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="inkMuted">측</Text>
          <Segmented
            options={SIDE_ORDER.map((s) => ({ key: s, label: SIDE_LABEL[s] }))}
            value={side}
            onChange={(k) => setSide(k as GuestSide)}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="inkMuted">관계</Text>
          <Segmented
            options={RELATION_ORDER.map((r) => ({ key: r, label: RELATION_LABEL[r] }))}
            value={relation}
            onChange={(k) => setRelation(k as GuestRelation)}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="inkMuted">참석 상태</Text>
          <Segmented
            options={ATTEND_ORDER.map((a) => ({ key: a, label: ATTEND_LABEL[a] }))}
            value={attendStatus}
            onChange={(k) => setAttendStatus(k as AttendStatus)}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="body">혼주</Text>
          <Switch value={isHost} onValueChange={setIsHost} />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="caption" color="inkMuted">식사 인원</Text>
            <TextInput
              value={mealCount} onChangeText={(t) => setMealCount(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.inkFaint}
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="caption" color="inkMuted">축의금(만원)</Text>
            <TextInput
              value={giftMan} onChangeText={(t) => setGiftMan(sanitizeManInput(t))}
              keyboardType="decimal-pad" placeholder="미접수" placeholderTextColor={colors.inkFaint}
              style={inputStyle}
            />
          </View>
        </View>

        <TextInput
          value={memo} onChangeText={setMemo} placeholder="메모 (선택)" placeholderTextColor={colors.inkFaint}
          multiline style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]}
        />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {editing && onDelete ? <Button variant="ghost" label="삭제" onPress={onDelete} /> : null}
          <View style={{ flex: 1 }} />
          <Button variant="ghost" label="취소" onPress={onClose} />
          <Button label="저장" onPress={submit} disabled={!canSave} />
        </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;

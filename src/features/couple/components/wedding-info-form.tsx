import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { Button, DateField, Switch, Text, TimeField } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Couple } from '@/types/db';
import type { UpdateCoupleInput } from '../api';

// 결혼 정보 편집 — 이름·날짜 미정 모드·날짜·시간·장소를 한 모달에 묶는다(design/settings.html은
// "두 사람"/"예식 날짜"/"예식 장소" 3개 행으로 나눠 보여주지만, 저장은 update_couple RPC 1번뿐이라
// 모달을 나눌 이유가 없다 — 일정 화면의 ScheduleForm과 동일한 추가/수정 공용 모달 패턴).
// 날짜 미정 모드가 켜져 있으면 DB의 couple_fixed_has_date 체크 제약과 무관하게 저장 가능하지만,
// 끄려면(FIXED) 날짜가 있어야 하므로 그 전까지 저장 버튼을 막는다.
export function WeddingInfoForm({
  visible, couple, onSubmit, onClose,
}: {
  visible: boolean;
  couple: Couple;
  onSubmit: (v: UpdateCoupleInput) => void;
  onClose: () => void;
}) {
  const [groomName, setGroomName] = useState(couple.groom_name);
  const [brideName, setBrideName] = useState(couple.bride_name);
  const [undecided, setUndecided] = useState(couple.wedding_date_status !== 'FIXED');
  const [weddingDate, setWeddingDate] = useState<string | null>(couple.wedding_date);
  const [weddingTime, setWeddingTime] = useState<string | null>(couple.wedding_time?.slice(0, 5) ?? null);
  const [venue, setVenue] = useState(couple.venue ?? '');

  const canSave = groomName.trim().length > 0 && brideName.trim().length > 0 && (undecided || weddingDate !== null);

  const submit = () => {
    onSubmit({
      groomName: groomName.trim(),
      brideName: brideName.trim(),
      weddingDate,
      weddingDateStatus: undecided ? 'UNDECIDED' : 'FIXED',
      weddingTime,
      venue: venue.trim() ? venue.trim() : null,
      notifyPayments: couple.notify_payments,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ backgroundColor: colors.ground, padding: layout.screenPadding, gap: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <Text variant="title">결혼 정보 편집</Text>

        <TextInput
          value={groomName} onChangeText={setGroomName} placeholder="신랑 이름" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <TextInput
          value={brideName} onChangeText={setBrideName} placeholder="신부 이름" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="body">날짜 미정 모드</Text>
            <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>날짜를 정하기 전까지 D-day를 숨긴다</Text>
          </View>
          <Switch value={undecided} onValueChange={setUndecided} />
        </View>

        <View style={{ opacity: undecided ? 0.5 : 1, gap: spacing.lg }} pointerEvents={undecided ? 'none' : 'auto'}>
          <DateField value={weddingDate} onChange={setWeddingDate} placeholder="예식 날짜 선택" />
          <TimeField value={weddingTime} onChange={setWeddingTime} placeholder="예식 시간 선택 (선택)" />
        </View>
        {!undecided && weddingDate === null ? (
          <Text variant="caption" color="terracottaInk">날짜를 선택해야 저장할 수 있어요.</Text>
        ) : null}

        <TextInput
          value={venue} onChangeText={setVenue} placeholder="예식 장소 (선택)" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }} />
          <Button variant="ghost" label="취소" onPress={onClose} />
          <Button label="저장" onPress={submit} disabled={!canSave} />
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;

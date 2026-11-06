import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Button, Chip, Segmented, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area, Assignee, ChecklistItem } from '@/types/db';
import { DateField } from './date-field';

export type ChecklistFormValue = {
  areaId: string; title: string; assignee: Assignee; dueDate: string | null; memo: string | null;
};

const ASSIGNEE_OPTS: { key: Assignee; label: string }[] = [
  { key: 'ME', label: '나' }, { key: 'PARTNER', label: '애인' }, { key: 'BOTH', label: '공동' },
];

// 추가/수정 공용 모달. editing이 있으면 수정 모드(영역 고정). 날짜는 DateField(달력 선택)로 받는다.
export function ChecklistForm({
  visible, areas, editing, defaultAreaId, onSubmit, onDelete, onClose,
}: {
  visible: boolean;
  areas: Area[];
  editing: ChecklistItem | null;
  defaultAreaId: string | null;
  onSubmit: (v: ChecklistFormValue) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [areaId, setAreaId] = useState(editing?.area_id ?? defaultAreaId ?? areas[0]?.id ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [assignee, setAssignee] = useState<Assignee>(editing?.assignee ?? 'BOTH');
  const [dueDate, setDueDate] = useState<string | null>(editing?.due_date ?? null);
  const [memo, setMemo] = useState(editing?.memo ?? '');

  const canSave = title.trim().length > 0 && areaId.length > 0;

  const submit = () => {
    onSubmit({
      areaId, title: title.trim(), assignee,
      dueDate,
      memo: memo.trim() ? memo.trim() : null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ backgroundColor: colors.ground, padding: layout.screenPadding, gap: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <Text variant="title">{editing ? '할 일 수정' : '할 일 추가'}</Text>

        {!editing ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {areas.map((a) => (
              <Pressable key={a.id} onPress={() => setAreaId(a.id)}>
                <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextInput
          value={title} onChangeText={setTitle} placeholder="할 일" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <Segmented
          options={ASSIGNEE_OPTS.map((o) => ({ key: o.key, label: o.label }))}
          value={assignee}
          onChange={(k) => setAssignee(k as Assignee)}
        />
        <DateField value={dueDate} onChange={setDueDate} placeholder="날짜 선택 (선택)" />
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
      </View>
    </Modal>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;

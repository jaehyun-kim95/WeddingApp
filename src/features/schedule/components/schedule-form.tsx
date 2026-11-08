import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Button, Chip, DateField, Segmented, Text, TimeField } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area, Assignee, EventCategory, ScheduleEvent } from '@/types/db';

export type ScheduleFormValue = {
  areaId: string | null;
  title: string;
  eventDate: string | null;
  eventTime: string | null;
  location: string | null;
  assignee: Assignee | null;
  category: EventCategory;
};

const ASSIGNEE_OPTS = [
  { key: 'ME', label: '나' }, { key: 'PARTNER', label: '애인' },
  { key: 'BOTH', label: '공동' }, { key: 'NONE', label: '미정' },
];
const CATEGORY_OPTS: { key: EventCategory; label: string }[] = [
  { key: 'EVENT', label: '일정' }, { key: 'IMPORTANT', label: '중요' },
];

// 추가/수정 공용 모달. editing이 있으면 수정 모드(영역 고정 — area_id는 생성 시에만 지정하는
// 체크리스트와 동일 관례). 날짜·시간 모두 전용 선택 UI(DateField·TimeField, 자유 텍스트 입력 금지
// — 사용자 결정 2026-11-08).
export function ScheduleForm({
  visible, areas, editing, defaultAreaId, onSubmit, onDelete, onClose,
}: {
  visible: boolean;
  areas: Area[];
  editing: ScheduleEvent | null;
  defaultAreaId: string | null;
  onSubmit: (v: ScheduleFormValue) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [areaId, setAreaId] = useState<string | null>(editing?.area_id ?? defaultAreaId ?? null);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [eventDate, setEventDate] = useState<string | null>(editing?.event_date ?? null);
  // DB의 event_time은 'HH:MM:SS'(초 포함) — 폼·TimeField는 'HH:MM'만 다루므로 앞 5글자만 취한다.
  const [eventTime, setEventTime] = useState<string | null>(editing?.event_time?.slice(0, 5) ?? null);
  const [location, setLocation] = useState(editing?.location ?? '');
  const [assignee, setAssignee] = useState<string>(editing?.assignee ?? 'NONE');
  const [category, setCategory] = useState<EventCategory>(editing?.category ?? 'EVENT');

  const canSave = title.trim().length > 0;

  const submit = () => {
    onSubmit({
      areaId,
      title: title.trim(),
      eventDate,
      eventTime,
      location: location.trim() ? location.trim() : null,
      assignee: assignee === 'NONE' ? null : (assignee as Assignee),
      category,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ backgroundColor: colors.ground, padding: layout.screenPadding, gap: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <Text variant="title">{editing ? '일정 수정' : '일정 추가'}</Text>

        {!editing ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Pressable onPress={() => setAreaId(null)}>
              <Chip variant={areaId === null ? 'area' : 'ghost'} label="없음" />
            </Pressable>
            {areas.map((a) => (
              <Pressable key={a.id} onPress={() => setAreaId(a.id)}>
                <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextInput
          value={title} onChangeText={setTitle} placeholder="일정 제목" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <DateField value={eventDate} onChange={setEventDate} placeholder="날짜 선택 (선택)" />
        <TimeField value={eventTime} onChange={setEventTime} placeholder="시간 선택 (선택)" />
        <TextInput
          value={location} onChangeText={setLocation} placeholder="장소 (선택)" placeholderTextColor={colors.inkFaint}
          style={inputStyle}
        />
        <Segmented options={CATEGORY_OPTS} value={category} onChange={(k) => setCategory(k as EventCategory)} />
        <Segmented options={ASSIGNEE_OPTS} value={assignee} onChange={setAssignee} />

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

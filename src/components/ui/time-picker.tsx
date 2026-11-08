import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { Button } from './button';
import { Text } from './text';

// 시간 선택 모달. CalendarPicker와 같은 다이얼로그 카드 스타일(320px·surface·line-strong 테두리)을
// 공유하되, 내용은 시(0~23)·분(5분 단위) 두 열의 휠 스크롤이다. 날짜 선택과 달리 "탭 즉시 확정"이
// 아니라 두 값을 다 고른 뒤 확인 버튼으로 커밋한다(두 열을 동시에 맞춰야 하므로).
export type TimePickerProps = {
  visible: boolean;
  value: string | null; // 'HH:MM' (초가 붙어 있어도 앞 5글자만 읽는다)
  onSelect: (time: string) => void;
  onClose: () => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function parseValue(value: string | null): { hour: string; minute: string } {
  if (!value) return { hour: '09', minute: '00' };
  const [hStr, mStr] = value.split(':');
  const hour = HOURS.includes(hStr) ? hStr : '09';
  const mNum = Number(mStr ?? 0);
  const minute = String(Math.round(mNum / 5) * 5 % 60).padStart(2, '0');
  return { hour, minute };
}

export function TimePicker({ visible, value, onSelect, onClose }: TimePickerProps) {
  const initial = parseValue(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  const confirm = () => onSelect(`${hour}:${minute}`);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <View style={styles.card}>
          <Text variant="titleSm" style={styles.title}>시간 선택</Text>
          <View style={styles.columns}>
            <TimeColumn options={HOURS} selected={hour} onSelect={setHour} suffix="시" />
            <TimeColumn options={MINUTES} selected={minute} onSelect={setMinute} suffix="분" />
          </View>
          <View style={styles.actions}>
            <Button variant="ghost" label="취소" onPress={onClose} />
            <Button label="확인" onPress={confirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TimeColumn({
  options, selected, onSelect, suffix,
}: { options: string[]; selected: string; onSelect: (v: string) => void; suffix: string }) {
  return (
    <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <Pressable key={opt} onPress={() => onSelect(opt)} style={[styles.row, active ? styles.rowActive : null]}>
            <Text variant="body" color={active ? 'blushInk' : 'ink'}>{opt}{suffix}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000066' },
  card: {
    width: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: spacing.lg,
  },
  title: { textAlign: 'center', marginBottom: spacing.md },
  columns: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  column: { height: 220, width: 100 },
  row: { paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  rowActive: { backgroundColor: colors.blushSoft },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
});

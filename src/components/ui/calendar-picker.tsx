import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { buildMonthGrid, monthLabel, shiftMonth, toDateString, WEEKDAY_LABELS, type CalendarCell } from './calendar-grid';
import { Text } from './text';

// 날짜 선택 모달. DESIGN.md Calendar Day Cell 규범을 재사용하되(주말=블러시 텍스트, 오늘=블러시-잉크
// 채움+흰 숫자, 우선순위 오늘>주말), 읽기 전용 달력의 "칸 전체를 둥근 사각으로 채움"과 달리 여기선
// "동그라미"로 렌더한다(실사용 피드백 — 선택 UI라 읽기 전용 달력과 시각적으로 구분할 필요).
// 선택된 날짜(오늘이 아닌 경우)는 블러시-잉크 테두리 링으로 별도 표시 — 읽기 전용 달력엔 없던,
// 피커 전용 신규 상태.
export type CalendarPickerProps = {
  visible: boolean;
  value: string | null; // 'YYYY-MM-DD'
  onSelect: (date: string) => void;
  onClose: () => void;
};

function todayDate() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

export function CalendarPicker({ visible, value, onSelect, onClose }: CalendarPickerProps) {
  const today = todayDate();
  const todayStr = toDateString(today.year, today.month, today.day);
  const initial = value
    ? { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) - 1 }
    : { year: today.year, month: today.month };
  const [view, setView] = useState(initial);

  const cells = buildMonthGrid(view.year, view.month);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable onPress={() => setView((v) => shiftMonth(v.year, v.month, -1))} hitSlop={8} style={styles.navBtn}>
              <Text variant="title">‹</Text>
            </Pressable>
            <Text variant="titleSm">{monthLabel(view.year, view.month)}</Text>
            <Pressable onPress={() => setView((v) => shiftMonth(v.year, v.month, 1))} hitSlop={8} style={styles.navBtn}>
              <Text variant="title">›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((w, i) => (
              <View key={w} style={styles.weekCell}>
                <Text variant="caption" color={i === 0 || i === 6 ? 'blushInk' : 'inkMuted'}>
                  {w}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell, idx) => (
              <DayCell
                key={idx}
                cell={cell}
                isToday={!!cell && cell.dateStr === todayStr}
                isSelected={!!cell && cell.dateStr === value}
                onPress={() => cell && onSelect(cell.dateStr)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DayCell({
  cell, isToday, isSelected, onPress,
}: { cell: CalendarCell; isToday: boolean; isSelected: boolean; onPress: () => void }) {
  if (!cell) return <View style={styles.dayWrap} />;

  const isWeekend = cell.weekday === 0 || cell.weekday === 6;
  const textColor = isToday ? 'surface' : isWeekend ? 'blushInk' : 'ink';

  return (
    <Pressable onPress={onPress} style={styles.dayWrap} accessibilityRole="button" accessibilityLabel={cell.dateStr}>
      <View
        style={[
          styles.dayMark,
          isToday ? { backgroundColor: colors.blushInk } : null,
          isSelected && !isToday ? { borderWidth: 2, borderColor: colors.blushInk } : null,
        ]}
      >
        <Text variant="bodySm" color={isSelected && !isToday ? 'blushInk' : textColor} style={isToday ? styles.todayText : undefined}>
          {cell.day}
        </Text>
      </View>
    </Pressable>
  );
}

const CELL_PCT = `${100 / 7}%`;

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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md,
  },
  navBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  weekRow: { flexDirection: 'row' },
  weekCell: { width: CELL_PCT, alignItems: 'center', paddingBottom: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayWrap: { width: CELL_PCT, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayMark: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  todayText: { fontWeight: '700' },
});

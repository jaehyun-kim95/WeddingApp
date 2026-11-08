import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import {
  buildMonthGrid, monthLabel, shiftMonth, WEEKDAY_LABELS, type CalendarCell,
} from '@/components/ui/calendar-grid';
import { colors, radius, spacing } from '@/constants/theme';
import type { EventCategory } from '@/types/db';

const CATEGORY_DOT: Record<EventCategory, 'sage' | 'terracotta' | 'blush'> = {
  EVENT: 'sage', IMPORTANT: 'terracotta', MILESTONE: 'blush',
};
const CELL_PCT = `${100 / 7}%`;

export type CalendarViewProps = {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  markersByDate: Record<string, EventCategory[]>;
  auspiciousDates: Set<string>;
  todayStr: string;
};

// 월 그리드(읽기 전용 + 날짜 탭). CalendarPicker와 달리 모달이 아니라 화면에 상시 노출되고,
// 선택 상태는 부모(schedule.tsx)가 들고 있다(날짜 탭 → 하단 상세 리스트 전환, 사용자 결정 2026-11-08).
// 월 그리드 계산은 CalendarPicker와 같은 순수 로직(calendar-grid.ts)을 재사용한다.
export function CalendarView({
  selectedDate, onSelectDate, markersByDate, auspiciousDates, todayStr,
}: CalendarViewProps) {
  const [view, setView] = useState({
    year: Number(selectedDate.slice(0, 4)),
    month: Number(selectedDate.slice(5, 7)) - 1,
  });
  const cells = buildMonthGrid(view.year, view.month);

  return (
    <View style={{
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong,
      borderRadius: radius.md, padding: spacing.lg,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Pressable onPress={() => setView((v) => shiftMonth(v.year, v.month, -1))} hitSlop={8}>
          <Text variant="title">‹</Text>
        </Pressable>
        <Text variant="titleSm">{monthLabel(view.year, view.month)}</Text>
        <Pressable onPress={() => setView((v) => shiftMonth(v.year, v.month, 1))} hitSlop={8}>
          <Text variant="title">›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <View key={w} style={{ width: CELL_PCT, alignItems: 'center', paddingBottom: spacing.xs }}>
            <Text variant="caption" color={i === 0 || i === 6 ? 'blushInk' : 'inkMuted'}>{w}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((cell, idx) => (
          <DayCell
            key={idx}
            cell={cell}
            todayStr={todayStr}
            selectedDate={selectedDate}
            categories={cell ? markersByDate[cell.dateStr] ?? [] : []}
            isAuspicious={!!cell && auspiciousDates.has(cell.dateStr)}
            onPress={() => cell && onSelectDate(cell.dateStr)}
          />
        ))}
      </View>
    </View>
  );
}

function DayCell({
  cell, todayStr, selectedDate, categories, isAuspicious, onPress,
}: {
  cell: CalendarCell; todayStr: string; selectedDate: string; categories: EventCategory[];
  isAuspicious: boolean; onPress: () => void;
}) {
  if (!cell) return <View style={{ width: CELL_PCT, aspectRatio: 1 }} />;

  const isToday = cell.dateStr === todayStr;
  const isSelected = cell.dateStr === selectedDate;
  const isWeekend = cell.weekday === 0 || cell.weekday === 6;
  const textColor = isToday ? 'surface' : isAuspicious ? 'terracottaInk' : isWeekend ? 'blushInk' : 'ink';

  return (
    <Pressable
      onPress={onPress}
      style={{ width: CELL_PCT, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel={cell.dateStr}
    >
      <View
        style={{
          width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isToday ? colors.blushInk : 'transparent',
          borderWidth: isSelected && !isToday ? 2 : 0,
          borderColor: colors.blushInk,
        }}
      >
        <Text
          variant="bodySm"
          color={isSelected && !isToday ? 'blushInk' : textColor}
          style={isToday || isAuspicious ? { fontWeight: '700' } : undefined}
        >
          {cell.day}
        </Text>
      </View>
      {categories.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2, height: 4 }}>
          {categories.slice(0, 3).map((c, i) => (
            <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors[CATEGORY_DOT[c]] }} />
          ))}
        </View>
      ) : (
        <View style={{ height: 4, marginTop: 2 }} />
      )}
    </Pressable>
  );
}

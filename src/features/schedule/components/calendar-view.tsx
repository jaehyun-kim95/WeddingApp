import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import {
  buildMonthGrid, monthLabel, shiftMonth, WEEKDAY_LABELS, type CalendarCell,
} from '@/components/ui/calendar-grid';
import { colors, radius, spacing } from '@/constants/theme';
import type { EventCategory } from '@/types/db';

// DESIGN.md "Event markers (언더바)" — 날짜 아래 카테고리색 가로 막대(pill). 점이 아니라 막대다
// (사용자 확정 — 점 표기 대체). MILESTONE은 시드 전용(폼 비노출)이라 중립 블러시로 예비 매핑만 둔다.
const CATEGORY_MARKER: Record<EventCategory, 'sage' | 'terracotta' | 'blush'> = {
  EVENT: 'sage', IMPORTANT: 'terracotta', MILESTONE: 'blush',
};
const CELL_PCT = `${100 / 7}%`;
const MARKER_SLOT_H = 3;
const MARKER_SLOT_GAP = 2;
const MARKER_MAX = 3;

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
      {/* DESIGN.md는 "오늘 칸 위에서는 막대를 흰색으로 반전"이라고 하지만, 그 전제는 오늘 칸
          전체가 블러시로 채워지는 경우다. 이 컴포넌트는 CalendarPicker와 같은 "숫자만 작은 원
          배지로 채움" 방식이라(날짜 선택 모달과 통일) 마커는 항상 원 바깥 흰 배경 위에 그려진다
          — 흰색으로 반전하면 흰 배경에 묻혀 안 보인다(실측으로 발견). 그래서 오늘 여부와 무관하게
          항상 카테고리색을 쓴다.
          슬롯은 항상 MARKER_MAX개를 그려 높이를 고정한다 — 실제 일정 수(0~3)에 따라 높이가
          바뀌면 부모(DayCell)가 세로 중앙 정렬이라 날짜 숫자 배지가 위아래로 밀린다(실측으로
          발견). 빈 슬롯은 투명 처리해 레이아웃만 차지하고 보이지 않게 한다. */}
      <View style={{
        width: '62%', flexDirection: 'column', gap: MARKER_SLOT_GAP, marginTop: 4,
        height: MARKER_MAX * MARKER_SLOT_H + (MARKER_MAX - 1) * MARKER_SLOT_GAP,
      }}>
        {Array.from({ length: MARKER_MAX }).map((_, i) => {
          const c = categories[i];
          return (
            <View
              key={i}
              style={{
                height: MARKER_SLOT_H, borderRadius: radius.pill,
                backgroundColor: c ? colors[CATEGORY_MARKER[c]] : 'transparent',
              }}
            />
          );
        })}
      </View>
    </Pressable>
  );
}

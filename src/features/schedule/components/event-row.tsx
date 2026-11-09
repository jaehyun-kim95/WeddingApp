import { Pressable, View } from 'react-native';
import { Chip, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { Area, EventCategory } from '@/types/db';
import type { TimelineItem } from '../types';
import { selectEventStatusChip, todayDateString } from '../api';

// 카테고리별 리드 점 색(design/schedule.html 범례 — 일정=세이지, 중요=테라코타).
// MILESTONE은 시드 전용(폼 비노출)이라 중립 블러시로 예비 매핑만 둔다.
const CATEGORY_DOT: Record<EventCategory, 'sage' | 'terracotta' | 'blush'> = {
  EVENT: 'sage', IMPORTANT: 'terracotta', MILESTONE: 'blush',
};

// 일정 한 줄: 카테고리 점 + 제목 + 영역 칩(있으면) + sub(시간·장소) + 우측 상태 칩.
// 체크리스트 CheckRow와 같은 모양이지만 체크박스가 없다(일정엔 완료 개념이 없다). 영역은
// 예전엔 sub 캡션 텍스트에 섞여 있었으나 눈에 잘 안 띈다는 실사용 피드백으로 별도 칩(area 배리언트,
// 준비영역 태그 전용)으로 분리했다.
export function EventRow({
  item, first, areas, onPress,
}: { item: TimelineItem; first: boolean; areas: Area[]; onPress: () => void }) {
  const area = areas.find((a) => a.id === item.areaId);
  const statusChip = selectEventStatusChip(item.date, todayDateString());

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingVertical: spacing.lg, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line,
      }}
    >
      <View style={{ paddingTop: 7 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors[CATEGORY_DOT[item.category]] }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" color="ink">{item.title}</Text>
        {area ? (
          <Chip variant="area" label={area.name_ko} style={{ marginTop: 6 }} />
        ) : null}
        {item.sub ? (
          <Text variant="caption" color="inkMuted" style={{ marginTop: area ? 6 : 2 }}>{item.sub}</Text>
        ) : null}
      </View>
      <Chip variant={statusChip.variant} label={statusChip.label} />
    </Pressable>
  );
}

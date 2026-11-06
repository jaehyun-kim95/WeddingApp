import { Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import type { Area } from '@/types/db';

// 영역 필터 칩(가로 스크롤). null = 전체. 선택 칩은 blushSoft/blushInk(목업).
export function AreaFilter({
  areas, selected, onSelect,
}: { areas: Area[]; selected: string | null; onSelect: (areaId: string | null) => void }) {
  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={{
        paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.pill,
        borderWidth: 1, borderColor: active ? 'transparent' : colors.lineStrong,
        backgroundColor: active ? colors.blushSoft : 'transparent', marginRight: spacing.sm,
      }}
    >
      <Text variant="label" color={active ? 'blushInk' : 'inkMuted'}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.xs }}>
      {chip('all', '전체', selected === null, () => onSelect(null))}
      {areas.map((a) => chip(a.id, a.name_ko, selected === a.id, () => onSelect(a.id)))}
    </ScrollView>
  );
}

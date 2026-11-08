import { View } from 'react-native';
import { Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import type { Area } from '@/types/db';
import type { AgendaGroup } from '../types';
import { EventRow } from './event-row';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

function formatGroupDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const w = WEEKDAY[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 · ${w}요일`;
}

// 날짜 그룹별 일정 리스트(아젠다 뷰). 빈 상태 포함.
export function AgendaView({
  groups, areas, onEdit,
}: { groups: AgendaGroup[]; areas: Area[]; onEdit: (id: string) => void }) {
  if (groups.length === 0) {
    return (
      <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
        <Text variant="body" color="inkMuted">아직 등록된 일정이 없습니다.</Text>
      </View>
    );
  }
  return (
    <View>
      {groups.map((g) => (
        <View key={g.date ?? 'undated'} style={{ marginTop: spacing.xl }}>
          <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>
            {g.date ? formatGroupDate(g.date) : '날짜 미정'}
          </Text>
          {g.items.map((item, idx) => (
            <EventRow key={item.id} item={item} first={idx === 0} areas={areas} onPress={() => onEdit(item.id)} />
          ))}
        </View>
      ))}
    </View>
  );
}

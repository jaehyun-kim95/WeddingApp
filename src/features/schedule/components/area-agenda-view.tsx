import { View } from 'react-native';
import { Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import type { Area } from '@/types/db';
import type { AreaAgendaGroup } from '../types';
import { EventRow } from './event-row';

// 영역별 일정 리스트(리스트 뷰의 "영역별" 세그먼트). AgendaView(날짜별)와 같은 모양이지만
// 헤더가 영역명이다. 체크리스트 AreaSection과 달리 진행률 미터는 없다(일정엔 완료 개념이 없다).
export function AreaAgendaView({
  groups, areas, onEdit,
}: { groups: AreaAgendaGroup[]; areas: Area[]; onEdit: (id: string) => void }) {
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
        <View key={g.area?.id ?? 'no-area'} style={{ marginTop: spacing.xl }}>
          <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>
            {g.area?.name_ko ?? '영역 없음'}
          </Text>
          {g.items.map((item, idx) => (
            <EventRow key={item.id} item={item} first={idx === 0} areas={areas} onPress={() => onEdit(item.id)} />
          ))}
        </View>
      ))}
    </View>
  );
}

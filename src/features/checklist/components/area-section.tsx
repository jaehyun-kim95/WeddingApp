import { View } from 'react-native';
import { Meter, Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import type { ChecklistSection } from '../types';
import type { ChecklistItem } from '@/types/db';
import { CheckRow } from './check-row';

// 영역 섹션: 헤더(영역명 + N% · done/total) + 얇은 미터 + 항목 리스트.
export function AreaSection({
  section, onToggle, onEdit,
}: {
  section: ChecklistSection;
  onToggle: (item: ChecklistItem) => void;
  onEdit: (item: ChecklistItem) => void;
}) {
  return (
    <View style={{ marginTop: spacing.xxxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="titleSm">{section.area.name_ko}</Text>
        <Text variant="caption" color="inkMuted" tabularNums>
          {section.percent}% · {section.doneCount}/{section.totalCount}
        </Text>
      </View>
      <Meter value={section.percent} style={{ height: 4, marginBottom: spacing.md }} />
      {section.items.map((item, idx) => (
        <CheckRow
          key={item.id}
          item={item}
          first={idx === 0}
          onToggle={() => onToggle(item)}
          onEdit={() => onEdit(item)}
        />
      ))}
    </View>
  );
}

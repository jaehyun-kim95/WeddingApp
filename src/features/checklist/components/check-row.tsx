import { Pressable, View } from 'react-native';
import { Chip, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { ChecklistItem } from '@/types/db';
import { CheckBox } from './check-box';

const ASSIGNEE_LABEL: Record<ChecklistItem['assignee'], string> = {
  ME: '나', PARTNER: '애인', BOTH: '공동',
};

// 체크리스트 한 행: 체크박스 + 제목(완료 시 취소선·톤다운) + 담당/날짜 sub + 메모 + 우측 예정 칩.
// 행 전체 탭 = 수정 열기, 체크박스 탭 = 토글(분리).
export function CheckRow({
  item, first, onToggle, onEdit,
}: { item: ChecklistItem; first: boolean; onToggle: () => void; onEdit: () => void }) {
  const sub = `담당 · ${ASSIGNEE_LABEL[item.assignee]}${item.due_date ? `  ·  ${item.due_date}` : ''}`;
  return (
    <Pressable
      onPress={onEdit}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingVertical: spacing.lg, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line,
      }}
    >
      <View style={{ paddingTop: 2 }}>
        <CheckBox checked={item.is_done} onPress={onToggle} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="body"
          color={item.is_done ? 'inkMuted' : 'ink'}
          style={item.is_done ? { textDecorationLine: 'line-through', textDecorationColor: colors.lineStrong } : undefined}
        >
          {item.title}
        </Text>
        <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>{sub}</Text>
        {item.memo ? (
          <Text variant="caption" color="inkMuted" style={{ marginTop: 6 }}>{item.memo}</Text>
        ) : null}
      </View>
      {!item.is_done ? <Chip variant="plan" label="예정" /> : null}
    </Pressable>
  );
}

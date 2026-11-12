import { View } from 'react-native';

import { Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { AttendStatus, Guest, GuestSide } from '@/types/db';
import { SIDE_LABEL, selectSideSummary } from '../api';
import type { GuestSection } from '../types';
import { GuestRow } from './guest-row';

// 측 섹션: 소제목("신랑 측 · N명 · 축의 M만", selectSideSummary) + 하객 리스트.
// 소계는 관계 필터와 무관하게 측 전체(allGuests) 기준(목업 — 필터는 행만 가리고 헤더 수는 고정).
// grouped가 주어지면(그룹 보기 ON) 관계별 소제목을 섞어 렌더, 아니면 rows를 평면 리스트로 렌더.
export function GuestSideSection({
  side, allGuests, rows, grouped, onEdit, onCycleAttend,
}: {
  side: GuestSide;
  allGuests: Guest[];
  rows: Guest[];
  grouped: GuestSection<Guest>[] | null;
  onEdit: (g: Guest) => void;
  onCycleAttend: (g: Guest, next: AttendStatus) => void;
}) {
  const summary = selectSideSummary(allGuests, side);

  return (
    <View style={{ marginTop: spacing.xxxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="titleSm">{SIDE_LABEL[side]}</Text>
        <Text variant="caption" color="inkMuted">
          <Text variant="bodySm" color="ink" tabularNums>{summary.count}명</Text> · 축의 {formatMan(summary.giftTotal)}
        </Text>
      </View>

      {grouped ? (
        grouped.map((section, sIdx) => (
          <View key={section.relation}>
            <Text variant="label" color="inkMuted" style={{ marginTop: sIdx === 0 ? 0 : spacing.md, marginBottom: spacing.xs }}>
              {section.label} {section.count}
            </Text>
            {section.guests.map((g, idx) => (
              <GuestRow
                key={g.id}
                guest={g}
                first={sIdx === 0 && idx === 0}
                onEdit={() => onEdit(g)}
                onCycleAttend={(next) => onCycleAttend(g, next)}
              />
            ))}
          </View>
        ))
      ) : (
        rows.map((g, idx) => (
          <GuestRow
            key={g.id}
            guest={g}
            first={idx === 0}
            onEdit={() => onEdit(g)}
            onCycleAttend={(next) => onCycleAttend(g, next)}
          />
        ))
      )}
    </View>
  );
}

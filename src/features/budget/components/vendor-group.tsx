import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { VendorRole } from '@/types/db';
import type { VendorGroup as VendorGroupType } from '../types';

const ROLE_LABEL: Record<VendorRole, string> = { STUDIO: '스튜디오', DRESS: '드레스', MAKEUP: '메이크업' };

// 업체 묶음(또는 직접 지출) — 순수 CSS 아코디언의 RN판(로컬 open 상태).
// 접힘(기본): 이름 한 줄 + "약정·납부·잔금" 한 줄 요약(미터·3셀 박스 제거 — 사용자 피드백 2026-11-10).
// 펼침(헤더 탭): 기본 견적·옵션 라인 + "수정 →"(편집 모달 진입). 편집은 카드 전체 탭이 아니라 수정 링크로 분리.
export function VendorGroup({ group, onEdit }: { group: VendorGroupType; onEdit: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.line }}>
      {/* 헤더(탭 = 펼침 토글) */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${group.name} ${open ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
      >
        {group.role ? <Chip variant="ghost" label={ROLE_LABEL[group.role]} /> : null}
        <Text variant="body" style={{ flexShrink: 1 }}>{group.name}</Text>
        {group.isDirect ? <Chip variant="ghost" label="직접 지출" /> : null}
        <View style={{ flex: 1 }} />
        <Text variant="caption" color="inkMuted">{open ? '▲' : '▼'}</Text>
      </Pressable>

      {/* 한 줄 요약: 약정 · 납부 · 잔금 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, gap: spacing.xs }}>
        <Text variant="caption" color="inkMuted">약정 </Text>
        <Text variant="caption" color="ink" tabularNums>{formatMan(group.finalAmount)}</Text>
        <Text variant="caption" color="inkFaint"> · </Text>
        <Text variant="caption" color="inkMuted">납부 </Text>
        <Text variant="caption" color="sageInk" tabularNums>{formatMan(group.paid)}</Text>
        <Text variant="caption" color="inkFaint"> · </Text>
        <Text variant="caption" color="inkMuted">잔금 </Text>
        <Text variant="caption" color="blushInk" tabularNums>{formatMan(group.remaining)}</Text>
      </View>

      {/* 펼침: 기본 견적 + 옵션 라인 + 수정 링크 */}
      {open ? (
        <View style={{ marginTop: spacing.sm }}>
          <View style={{ gap: 3 }}>
            {group.lines.map((line) => (
              <View key={line.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                <Text variant="meta" color={line.isOption ? 'blushInk' : 'inkMuted'} style={{ flexShrink: 1 }}>
                  {line.isOption ? `+ ${line.name}` : line.name}
                </Text>
                <Text variant="meta" color={line.isOption ? 'blushInk' : 'ink'} tabularNums>
                  {formatMan(line.amount)}
                </Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`${group.name} 수정`}
            style={{ alignSelf: 'flex-end', paddingVertical: spacing.xs, marginTop: spacing.xs }}
          >
            <Text variant="caption" color="blushInk">수정 →</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

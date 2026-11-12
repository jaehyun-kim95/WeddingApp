import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { GuestRelation } from '@/types/db';
import { RELATION_LABEL } from '../api';

// 관계 다중선택 필터(area-filter-dropdown.tsx 복제 — Area 대신 GuestRelation 4개).
// 빈 선택 = 전체 노출(OR 규칙). 선택 상태는 화면이 소유(클라이언트 전용, 저장 안 함).
export function RelationFilterDropdown({
  relations, selected, onChange,
}: {
  relations: GuestRelation[];
  selected: Set<GuestRelation>;
  onChange: (next: Set<GuestRelation>) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.size > 0;

  const toggle = (relation: GuestRelation) => {
    const next = new Set(selected);
    if (next.has(relation)) next.delete(relation);
    else next.add(relation);
    onChange(next);
  };

  return (
    <View>
      {/* 트리거 pill — 선택 있으면 블러시 활성 톤 */}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="관계 필터"
        style={{
          alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
          paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: active ? 'transparent' : colors.lineStrong,
          backgroundColor: active ? colors.blushSoft : 'transparent',
        }}
      >
        <Text variant="caption" color={active ? 'blushInk' : 'inkMuted'}>
          관계{active ? ` · ${selected.size}` : ''} ▾
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center' }} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              marginHorizontal: layout.screenPadding, backgroundColor: colors.surface,
              borderRadius: radius.lg, padding: layout.screenPadding, gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs }}>
              <Text variant="title">관계 필터</Text>
              {active ? (
                <Pressable onPress={() => onChange(new Set())} accessibilityRole="button">
                  <Text variant="caption" color="blushInk">전체 보기</Text>
                </Pressable>
              ) : null}
            </View>
            {relations.map((r) => {
              const on = selected.has(r);
              return (
                <Pressable
                  key={r}
                  onPress={() => toggle(r)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}
                >
                  <View
                    style={{
                      width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.6,
                      borderColor: on ? colors.blushInk : colors.lineStrong,
                      backgroundColor: on ? colors.blushInk : colors.surface,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {on ? <Text variant="caption" style={{ color: colors.surface }}>✓</Text> : null}
                  </View>
                  <Text variant="body">{RELATION_LABEL[r]}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fab, Meter, PageHead, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useAreas } from '@/hooks/use-areas';
import {
  groupByArea, overallPercent, useChecklist,
  useCreateChecklistItem, useDeleteChecklistItem, useToggleChecklistItem, useUpdateChecklistItem,
} from '@/features/checklist';
import { AreaFilter } from '@/features/checklist/components/area-filter';
import { AreaSection } from '@/features/checklist/components/area-section';
import { ChecklistForm, type ChecklistFormValue } from '@/features/checklist/components/checklist-form';
import type { ChecklistItem } from '@/types/db';

export default function ChecklistScreen() {
  const { data: items = [] } = useChecklist();
  const { data: areas = [] } = useAreas();
  const create = useCreateChecklistItem();
  const update = useUpdateChecklistItem();
  const toggle = useToggleChecklistItem();
  const remove = useDeleteChecklistItem();

  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  // 열 때마다 증가시켜 ChecklistForm을 리마운트한다 — 폼 내부 state(제목·메모 등)는 useState
  // 초기값으로만 세팅되므로 Modal을 visible만 토글하면 마운트가 유지돼 이전 입력이 남는다.
  const [formKey, setFormKey] = useState(0);

  const sections = useMemo(() => {
    const grouped = groupByArea(items, areas);
    return areaFilter ? grouped.filter((s) => s.area.id === areaFilter) : grouped;
  }, [items, areas, areaFilter]);
  const visibleSections = sections.filter((s) => s.totalCount > 0);
  const overall = overallPercent(items);

  const openAdd = () => { setEditing(null); setFormKey((k) => k + 1); setFormOpen(true); };
  const openEdit = (item: ChecklistItem) => { setEditing(item); setFormKey((k) => k + 1); setFormOpen(true); };
  const closeForm = () => setFormOpen(false);

  const submitForm = (v: ChecklistFormValue) => {
    if (editing) {
      update.mutate({ id: editing.id, title: v.title, assignee: v.assignee, dueDate: v.dueDate, memo: v.memo });
    } else {
      create.mutate(v);
    }
    closeForm();
  };
  const deleteCurrent = () => {
    if (editing) remove.mutate({ id: editing.id });
    closeForm();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: layout.tabBarHeight + 80 }}>
        <PageHead title="체크리스트" sub="영역별 할 일" />

        {/* 전체 진행률 */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text variant="bodySm" color="inkMuted">전체 체크리스트 진행</Text>
            <Text variant="bodySm" tabularNums>{overall}%</Text>
          </View>
          <Meter value={overall} />
        </View>

        {/* 영역 필터 */}
        <View style={{ marginTop: spacing.xl }}>
          <AreaFilter areas={areas} selected={areaFilter} onSelect={setAreaFilter} />
        </View>

        {/* 영역별 섹션 or 빈 상태 */}
        {items.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
            <Text variant="body" color="inkMuted">아직 할 일이 없습니다.</Text>
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
              아래 &lsquo;할 일 추가&rsquo;로 시작하세요.
            </Text>
          </View>
        ) : (
          visibleSections.map((s) => (
            <AreaSection
              key={s.area.id}
              section={s}
              onToggle={(item) => toggle.mutate({ id: item.id, isDone: !item.is_done })}
              onEdit={openEdit}
            />
          ))
        )}
      </ScrollView>

      <Fab label="할 일 추가" onPress={openAdd} />

      <ChecklistForm
        key={formKey}
        visible={formOpen}
        areas={areas}
        editing={editing}
        defaultAreaId={areaFilter}
        onSubmit={submitForm}
        onDelete={editing ? deleteCurrent : undefined}
        onClose={closeForm}
      />
    </SafeAreaView>
  );
}

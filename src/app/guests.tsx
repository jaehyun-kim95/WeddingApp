import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Fab, Switch, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useCouple } from '@/features/couple';
import {
  ExcelImportPreview, GuestForm, GuestSideSection, MealPriceField,
  RelationFilterDropdown, SideSegmented,
  exportGuestsToExcel, groupByRelation, pickAndParseExcel, RELATION_ORDER, SIDE_ORDER,
  summarizeGuests,
  useCreateGuest, useDeleteGuest, useGuests,
  useImportGuests, useSetAttendStatus, useUpdateGuest,
} from '@/features/guests';
import type { GuestFormValue, ImportGuestRow, RowError, SideFilterValue } from '@/features/guests';
import { formatMan } from '@/lib/money';
import type { AttendStatus, Guest, GuestRelation } from '@/types/db';

export default function GuestsScreen() {
  const insets = useSafeAreaInsets();
  const { data: couple } = useCouple();
  const { data: guests = [] } = useGuests();

  const create = useCreateGuest();
  const update = useUpdateGuest();
  const setAttend = useSetAttendStatus();
  const remove = useDeleteGuest();
  const importGuests = useImportGuests();

  const [sideFilter, setSideFilter] = useState<SideFilterValue>('ALL');
  const [relationFilter, setRelationFilter] = useState<Set<GuestRelation>>(new Set());
  const [groupOn, setGroupOn] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  // 열 때마다 증가시켜 GuestForm을 리마운트(checklist-form.tsx와 동일한 이유).
  const [formKey, setFormKey] = useState(0);

  const [importPreview, setImportPreview] = useState<{ valid: ImportGuestRow[]; errors: RowError[] } | null>(null);
  const [exporting, setExporting] = useState(false);

  // 네이티브 스택 헤더가 이미 "← 하객 관리" 제목+뒤로가기를 제공한다(_layout.tsx의
  // headerShown:true). 여기선 PageHead를 중복으로 쓰지 않고, 맥락만 작은 메타 줄로 보탠다.
  const sub = couple
    ? `${couple.groom_name} & ${couple.bride_name}${couple.wedding_date ? ` · ${couple.wedding_date}` : ''}`
    : undefined;

  const visibleSides = sideFilter === 'ALL' ? SIDE_ORDER : [sideFilter];

  const mealPriceWon = couple?.meal_price ?? 0;
  // 상단 요약은 측 세그먼트(전체/신랑측/신부측)에 맞춰 범위를 좁힌다 — 목록만 필터되고 요약은 항상
  // "전체"로 남아 있던 불일치를 해소(사용자 요청 2026-11-12).
  const summary = useMemo(() => {
    const scoped = sideFilter === 'ALL' ? guests : guests.filter((g) => g.side === sideFilter);
    return summarizeGuests(scoped, mealPriceWon);
  }, [guests, sideFilter, mealPriceWon]);

  const openAdd = () => { setEditing(null); setFormKey((k) => k + 1); setFormOpen(true); };
  const openEdit = (g: Guest) => { setEditing(g); setFormKey((k) => k + 1); setFormOpen(true); };
  const closeForm = () => setFormOpen(false);

  const submitForm = (v: GuestFormValue) => {
    if (editing) {
      update.mutate({ id: editing.id, ...v });
    } else {
      create.mutate(v);
    }
    closeForm();
  };
  const deleteCurrent = () => {
    if (editing) remove.mutate({ id: editing.id });
    closeForm();
  };

  const onImportPress = async () => {
    const result = await pickAndParseExcel();
    if (!result) return;
    setImportPreview(result);
  };
  const confirmImport = () => {
    if (importPreview && importPreview.valid.length > 0) importGuests.mutate(importPreview.valid);
    setImportPreview(null);
  };

  const onExportPress = async () => {
    setExporting(true);
    try {
      await exportGuestsToExcel(guests);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: 100 + insets.bottom }}>
        {sub ? <Text variant="meta" color="inkMuted">{sub}</Text> : null}

        {/* 상단 요약 3값: 하객 수 / 예상 식사 / 축의금 — 측 세그먼트(전체/신랑/신부)에 맞춰 범위가 바뀐다 */}
        <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="inkMuted">하객</Text>
            <Text variant="stat" tabularNums style={{ marginTop: 3 }}>{summary.total}명</Text>
            <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>
              참석 확정 {summary.attending} · 미정 {summary.maybe}
            </Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: spacing.md }}>
            <Text variant="caption" color="inkMuted">예상 식사</Text>
            <Text variant="stat" tabularNums style={{ marginTop: 3 }}>{summary.mealCount}명</Text>
            <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>
              식대 {formatMan(summary.mealPrice)} · {formatMan(summary.mealTotal)}
            </Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: spacing.md }}>
            <Text variant="caption" color="inkMuted">축의금</Text>
            <Text variant="stat" color="blushInk" tabularNums style={{ marginTop: 3 }}>{formatMan(summary.giftTotal)}</Text>
            <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>
              접수 {summary.giftCount}명
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <MealPriceField priceWon={mealPriceWon} />
        </View>

        {/* 엑셀 가져오기/내보내기 */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <Button variant="ghost" label="엑셀 가져오기" onPress={onImportPress} style={{ flex: 1 }} />
          <Button
            variant="ghost"
            label={exporting ? '내보내는 중…' : '엑셀 내보내기'}
            onPress={onExportPress}
            disabled={exporting}
            style={{ flex: 1 }}
          />
        </View>

        {/* 측 세그먼트 + 관계 필터 + 그룹 보기 */}
        <View style={{ marginTop: spacing.xl }}>
          <SideSegmented value={sideFilter} onChange={setSideFilter} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
            <RelationFilterDropdown relations={RELATION_ORDER} selected={relationFilter} onChange={setRelationFilter} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="caption" color="inkMuted">그룹으로 보기</Text>
              <Switch value={groupOn} onValueChange={setGroupOn} />
            </View>
          </View>
        </View>

        {/* 측별 섹션 or 빈 상태 */}
        {guests.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
            <Text variant="body" color="inkMuted">아직 등록된 하객이 없습니다.</Text>
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
              아래 &lsquo;하객 추가&rsquo;로 시작하세요.
            </Text>
          </View>
        ) : (
          visibleSides.map((side) => {
            const sideGuests = guests.filter((g) => g.side === side);
            if (sideGuests.length === 0) return null;
            const filtered = relationFilter.size === 0
              ? sideGuests
              : sideGuests.filter((g) => relationFilter.has(g.relation));
            return (
              <GuestSideSection
                key={side}
                side={side}
                allGuests={guests}
                rows={filtered}
                grouped={groupOn ? groupByRelation(filtered) : null}
                onEdit={openEdit}
                onCycleAttend={(g, next: AttendStatus) => setAttend.mutate({ id: g.id, status: next })}
              />
            );
          })
        )}
      </ScrollView>

      <Fab label="하객 추가" onPress={openAdd} bottomInset={insets.bottom} />

      <GuestForm
        key={formKey}
        visible={formOpen}
        editing={editing}
        onSubmit={submitForm}
        onDelete={editing ? deleteCurrent : undefined}
        onClose={closeForm}
      />

      <ExcelImportPreview
        visible={importPreview !== null}
        valid={importPreview?.valid ?? []}
        errors={importPreview?.errors ?? []}
        onConfirm={confirmImport}
        onClose={() => setImportPreview(null)}
      />
    </SafeAreaView>
  );
}

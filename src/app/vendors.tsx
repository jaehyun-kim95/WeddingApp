import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useCouple, useCoupleSnapshot } from '@/features/couple';
import { AreaFilter } from '@/features/checklist/components/area-filter';
import {
  findLinkedExpense, useCreateVendor, useDeleteVendor, useUpdateVendor, useVendorsByArea,
  VendorCandidateRow, VendorContractPanel, VendorForm,
} from '@/features/vendors';
import type { VendorFormValue } from '@/features/vendors';
import { useAreas } from '@/hooks/use-areas';
import type { Vendor } from '@/types/db';

// 네이티브 스택 헤더가 이미 "← 업체 관리" 제목+뒤로가기를 제공한다(_layout.tsx의 headerShown:true).
// PageHead를 중복으로 쓰지 않는다(하객 화면과 동일 패턴).
export default function VendorsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: couple } = useCouple();
  const { data: areas = [] } = useAreas();
  const { data: snapshot } = useCoupleSnapshot();
  const { data: groups = [] } = useVendorsByArea(areas);

  const create = useCreateVendor();
  const update = useUpdateVendor();
  const remove = useDeleteVendor();

  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Vendor | null>(null);

  const visibleGroups = areaFilter === null ? groups : groups.filter((g) => g.area.id === areaFilter);
  const hasAny = groups.some((g) => g.contracted.length > 0 || g.candidates.length > 0);

  const openAdd = () => { setEditing(null); setFormKey((k) => k + 1); setFormOpen(true); };
  const openEdit = (v: Vendor) => { setEditing(v); setFormKey((k) => k + 1); setFormOpen(true); };
  const closeForm = () => setFormOpen(false);

  const submitForm = (v: VendorFormValue) => {
    if (editing) {
      // areaId는 생성 시 고정(체크리스트 관례) — UpdateVendorInput에 없는 필드라 명시적으로 뺀다.
      update.mutate({
        id: editing.id, name: v.name, status: v.status, role: v.role,
        location: v.location, contractDate: v.contractDate, quotedPrice: v.quotedPrice, memo: v.memo,
      });
    } else {
      create.mutate(v);
    }
    closeForm();
  };
  const deleteCurrent = () => {
    if (editing) remove.mutate({ id: editing.id });
    closeForm();
  };
  const goToExpense = (expenseId: string) => {
    router.push({ pathname: '/budget', params: { expenseId } });
  };

  const sub = couple
    ? `${couple.groom_name} & ${couple.bride_name}${couple.wedding_date ? ` · ${couple.wedding_date}` : ''}`
    : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: 100 + insets.bottom }}>
        {sub ? <Text variant="meta" color="inkMuted">{sub}</Text> : null}

        <View style={{ marginTop: spacing.lg }}>
          <AreaFilter areas={areas} selected={areaFilter} onSelect={setAreaFilter} />
        </View>

        {!hasAny ? (
          <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
            <Text variant="body" color="inkMuted">아직 등록된 업체가 없습니다.</Text>
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
              아래 &lsquo;업체 추가&rsquo;로 시작하세요.
            </Text>
          </View>
        ) : (
          visibleGroups.map((g) => {
            if (g.contracted.length === 0 && g.candidates.length === 0) return null;
            return (
              <View key={g.area.id} style={{ marginTop: spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Text variant="titleSm">{g.area.name_ko}</Text>
                  <Text variant="caption" color="inkMuted">
                    {g.contracted.length > 0 ? `계약 ${g.contracted.length}` : '미계약'}
                    {g.candidates.length > 0 ? ` · 후보 ${g.candidates.length}곳` : ''}
                  </Text>
                </View>

                {g.contracted.map((v) => (
                  <VendorContractPanel
                    key={v.id}
                    vendor={v}
                    linkedExpenseId={snapshot ? findLinkedExpense(snapshot, v.id)?.id ?? null : null}
                    onPress={() => openEdit(v)}
                    onViewExpense={goToExpense}
                  />
                ))}

                {g.candidates.length > 0 ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Text variant="caption" color="inkMuted">검토했던 후보</Text>
                    {g.candidates.map((v, i) => (
                      <VendorCandidateRow key={v.id} vendor={v} onPress={() => openEdit(v)} first={i === 0} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Fab label="업체 추가" onPress={openAdd} bottomInset={insets.bottom} />

      <VendorForm
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

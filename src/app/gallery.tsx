import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { AreaFilter } from '@/features/checklist/components/area-filter';
import { useCouple } from '@/features/couple';
import {
  hasVisiblePhotos, PhotoGrid, PhotoUploadSheet, PhotoViewerModal, pickImages, savePhotosToDevice,
  SelectionActionBar, shareablePhotos, sharePhotosSequentially, StorageUsageBanner,
  useDeletePhoto, usePhotosByArea, useStorageUsage, useUploadPhoto,
} from '@/features/gallery';
import type { PickedPhoto } from '@/features/gallery';
import { useAreas } from '@/hooks/use-areas';
import type { Photo } from '@/types/db';

// 네이티브 스택 헤더가 이미 "← 갤러리" 제목+뒤로가기를 제공한다(_layout.tsx의 headerShown:true).
// PageHead를 중복으로 쓰지 않는다(업체·하객 화면과 동일 패턴).
export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { data: couple } = useCouple();
  const { data: areas = [] } = useAreas();
  const { data: groups = [] } = usePhotosByArea(areas);
  const { data: usage } = useStorageUsage();

  const upload = useUploadPhoto();
  const remove = useDeletePhoto();

  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [pickedKey, setPickedKey] = useState(0);
  const [viewing, setViewing] = useState<Photo | null>(null);

  // 선택 모드: 그리드에서 여러 장을 골라 사진첩 저장/순차 공유. transferBusy는 Storage 다운로드~
  // 저장/공유가 끝날 때까지 액션바 버튼을 잠근다(중복 실행 방지).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferBusy, setTransferBusy] = useState(false);

  const visibleGroups = areaFilter === null ? groups : groups.filter((g) => g.area.id === areaFilter);
  const hasAny = hasVisiblePhotos(groups, areaFilter);

  const openPicker = async () => {
    const result = await pickImages();
    if (result.length > 0) {
      setPicked(result);
      setPickedKey((k) => k + 1);
    }
  };
  const confirmUpload = (areaId: string) => {
    if (picked.length === 0) return;
    upload.mutate({ areaId, picked });
    setPicked([]);
  };
  const confirmDelete = (photo: Photo) => {
    if (photo.storage_path) remove.mutate({ id: photo.id, storagePath: photo.storage_path });
    setViewing(null);
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };
  const toggleSelect = (photo: Photo) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  };

  // 선택된 id → 실제 Photo(전체 그룹 기준으로 해석 — 영역 필터가 바뀌어도 선택이 유지된다) →
  // 저장/공유 가능한 것만 추림(영상·storage_path 없는 것 제외).
  const runTransfer = async (kind: 'save' | 'share') => {
    const chosen = shareablePhotos(groups.flatMap((g) => g.photos).filter((p) => selected.has(p.id)));
    if (chosen.length === 0) return;
    setTransferBusy(true);
    try {
      if (kind === 'save') {
        const n = await savePhotosToDevice(chosen);
        if (n > 0) Alert.alert('저장 완료', `${n}장을 사진첩에 저장했습니다.`);
      } else {
        await sharePhotosSequentially(chosen);
      }
      exitSelection();
    } catch (e) {
      Alert.alert(
        kind === 'save' ? '저장하지 못했습니다' : '공유하지 못했습니다',
        e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.',
      );
    } finally {
      setTransferBusy(false);
    }
  };

  const sub = couple
    ? `${couple.groom_name} & ${couple.bride_name}${couple.wedding_date ? ` · ${couple.wedding_date}` : ''}`
    : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: 100 + insets.bottom }}>
        {sub ? <Text variant="meta" color="inkMuted">{sub}</Text> : null}

        <View style={{ marginTop: spacing.lg }}>
          <StorageUsageBanner
            count={usage?.count ?? 0}
            totalBytes={usage?.totalBytes ?? 0}
            nearLimit={usage?.nearLimit ?? false}
          />
        </View>

        {hasAny ? (
          <View style={{ marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text variant="bodySm" color="sageInk">{selectionMode ? '취소' : '선택'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.md }}>
          <AreaFilter areas={areas} selected={areaFilter} onSelect={setAreaFilter} />
        </View>

        {!hasAny ? (
          <View style={{ paddingVertical: spacing.xxxl * 2, alignItems: 'center' }}>
            <Text variant="body" color="inkMuted">아직 등록된 사진이 없습니다.</Text>
            <Text variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
              아래 &lsquo;사진 추가&rsquo;로 시작하세요.
            </Text>
          </View>
        ) : (
          visibleGroups.map((g) => {
            if (g.photos.length === 0) return null;
            return (
              <View key={g.area.id} style={{ marginTop: spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text variant="titleSm">{g.area.name_ko}</Text>
                  <Text variant="caption" color="inkMuted">{g.photos.length}장</Text>
                </View>
                <PhotoGrid
                  photos={g.photos}
                  onPressPhoto={setViewing}
                  selectionMode={selectionMode}
                  selectedIds={selected}
                  onToggleSelect={toggleSelect}
                />
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 선택 모드 중엔 FAB을 숨기고 하단 액션바를 띄운다(동시에 두 플로팅이 겹치지 않게). */}
      {selectionMode ? (
        selected.size > 0 ? (
          <SelectionActionBar
            count={selected.size}
            busy={transferBusy}
            onSave={() => runTransfer('save')}
            onShare={() => runTransfer('share')}
            bottomInset={insets.bottom}
          />
        ) : null
      ) : (
        <Fab label="사진 추가" onPress={openPicker} bottomInset={insets.bottom} />
      )}

      <PhotoUploadSheet
        key={pickedKey}
        picked={picked}
        areas={areas}
        defaultAreaId={areaFilter}
        uploading={upload.isPending}
        onConfirm={confirmUpload}
        onCancel={() => setPicked([])}
      />
      <PhotoViewerModal photo={viewing} onDelete={confirmDelete} onClose={() => setViewing(null)} />
    </SafeAreaView>
  );
}

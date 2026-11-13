import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { AreaFilter } from '@/features/checklist/components/area-filter';
import { useCouple } from '@/features/couple';
import {
  hasVisiblePhotos, PhotoGrid, PhotoUploadSheet, PhotoViewerModal, pickImage, StorageUsageBanner,
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
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [pickedKey, setPickedKey] = useState(0);
  const [viewing, setViewing] = useState<Photo | null>(null);

  const visibleGroups = areaFilter === null ? groups : groups.filter((g) => g.area.id === areaFilter);
  const hasAny = hasVisiblePhotos(groups, areaFilter);

  const openPicker = async () => {
    const result = await pickImage();
    if (result) {
      setPicked(result);
      setPickedKey((k) => k + 1);
    }
  };
  const confirmUpload = (areaId: string) => {
    if (!picked) return;
    upload.mutate({ areaId, picked });
    setPicked(null);
  };
  const confirmDelete = (photo: Photo) => {
    if (photo.storage_path) remove.mutate({ id: photo.id, storagePath: photo.storage_path });
    setViewing(null);
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

        <View style={{ marginTop: spacing.xl }}>
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
                <PhotoGrid photos={g.photos} onPressPhoto={setViewing} />
              </View>
            );
          })
        )}
      </ScrollView>

      <Fab label="사진 추가" onPress={openPicker} bottomInset={insets.bottom} />

      <PhotoUploadSheet
        key={pickedKey}
        picked={picked}
        areas={areas}
        defaultAreaId={areaFilter}
        uploading={upload.isPending}
        onConfirm={confirmUpload}
        onCancel={() => setPicked(null)}
      />
      <PhotoViewerModal photo={viewing} onDelete={confirmDelete} onClose={() => setViewing(null)} />
    </SafeAreaView>
  );
}

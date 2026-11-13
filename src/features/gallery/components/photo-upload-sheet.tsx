import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, Chip, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area } from '@/types/db';
import type { PickedPhoto } from '../upload';

// 업로드 전 영역 선택(설계 스펙 결정 6 — 업로드 시 1회 선택, 이후 고정). picked가 없으면 아무것도
// 렌더링하지 않는다 — 화면이 pickImage() 호출 후 결과가 있을 때만 이 컴포넌트를 "연다"(key prop을
// 바꿔 매번 영역 선택 상태를 리셋).
export function PhotoUploadSheet({
  picked, areas, defaultAreaId, uploading, onConfirm, onCancel,
}: {
  picked: PickedPhoto | null;
  areas: Area[];
  defaultAreaId: string | null;
  uploading: boolean;
  onConfirm: (areaId: string) => void;
  onCancel: () => void;
}) {
  const [areaId, setAreaId] = useState(defaultAreaId ?? areas[0]?.id ?? '');

  if (!picked) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000066' }} onPress={onCancel} />
      <View style={{ maxHeight: '88%', backgroundColor: colors.ground, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <ScrollView contentContainerStyle={{ padding: layout.screenPadding, gap: spacing.lg }}>
          <Text variant="title">사진 추가</Text>
          <Image
            source={{ uri: picked.previewUri }}
            style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md }}
            resizeMode="cover"
          />
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodySm" color="inkMuted">영역</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {areas.map((a) => (
                <Pressable key={a.id} onPress={() => setAreaId(a.id)}>
                  <Chip variant={areaId === a.id ? 'area' : 'ghost'} label={a.name_ko} />
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="ghost" label="취소" onPress={onCancel} disabled={uploading} />
            <Button
              label={uploading ? '업로드 중...' : '업로드'}
              onPress={() => onConfirm(areaId)}
              disabled={uploading || !areaId}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, Chip, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { Area } from '@/types/db';
import type { PickedPhoto } from '../upload';

// 업로드 전 영역 선택(설계 스펙 결정 6 — 업로드 시 1회 선택, 이후 고정). 여러 장을 골라도 영역은
// 한 번만 고르고 전부 같은 영역에 올라간다. picked가 빈 배열이면 아무것도 렌더링하지 않는다 —
// 화면이 pickImages() 호출 후 결과가 있을 때만 이 컴포넌트를 "연다"(key prop을 바꿔 매번 영역
// 선택 상태를 리셋).
export function PhotoUploadSheet({
  picked, areas, defaultAreaId, uploading, onConfirm, onCancel,
}: {
  picked: PickedPhoto[];
  areas: Area[];
  defaultAreaId: string | null;
  uploading: boolean;
  onConfirm: (areaId: string) => void;
  onCancel: () => void;
}) {
  const [areaId, setAreaId] = useState(defaultAreaId ?? areas[0]?.id ?? '');

  if (picked.length === 0) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000066' }} onPress={onCancel} />
      <View style={{ maxHeight: '88%', backgroundColor: colors.ground, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <ScrollView contentContainerStyle={{ padding: layout.screenPadding, gap: spacing.lg }}>
          <Text variant="title">사진 추가{picked.length > 1 ? ` · ${picked.length}장` : ''}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {picked.map((p, i) => (
              <Image
                key={`${p.previewUri}-${i}`}
                source={{ uri: p.previewUri }}
                style={{
                  width: picked.length === 1 ? '100%' : '31.3%',
                  aspectRatio: 1,
                  borderRadius: radius.md,
                }}
                resizeMode="cover"
              />
            ))}
          </View>
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
              label={uploading ? '업로드 중...' : picked.length > 1 ? `${picked.length}장 업로드` : '업로드'}
              onPress={() => onConfirm(areaId)}
              disabled={uploading || !areaId}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

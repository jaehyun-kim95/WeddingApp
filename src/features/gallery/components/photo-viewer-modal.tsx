import { Image, Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui';
import { layout, radius, spacing } from '@/constants/theme';
import type { Photo } from '@/types/db';
import { photoPublicUrl } from '../upload';

// 원본 보기+삭제만 지원(설계 스펙 결정 5 — 영역 재분류·캡션 편집 없음).
export function PhotoViewerModal({
  photo, onDelete, onClose,
}: { photo: Photo | null; onDelete: (photo: Photo) => void; onClose: () => void }) {
  if (!photo) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000dd', justifyContent: 'center', alignItems: 'center', padding: layout.screenPadding }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
        <View style={{ width: '100%', maxWidth: layout.appMaxWidth, gap: spacing.md }}>
          {photo.storage_path ? (
            <Image
              source={{ uri: photoPublicUrl(photo.storage_path) }}
              style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg }}
              resizeMode="contain"
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="ghost" label="닫기" onPress={onClose} />
            <Button label="삭제" onPress={() => onDelete(photo)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

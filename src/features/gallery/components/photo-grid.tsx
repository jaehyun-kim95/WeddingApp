import { Image, Pressable, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { Photo } from '@/types/db';
import { photoPublicUrl } from '../upload';

// 목업 `.photo-grid`(3열 정사각). 이미지 격자 = 카드그리드 금지의 예외(DESIGN.md).
export function PhotoGrid({
  photos, onPressPhoto,
}: { photos: Photo[]; onPressPhoto: (photo: Photo) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {photos.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onPressPhoto(p)}
          accessibilityRole="button"
          accessibilityLabel="사진 보기"
          style={{
            width: '31.3%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden',
            borderWidth: 1, borderColor: colors.line, backgroundColor: colors.groundDeep,
          }}
        >
          {p.storage_path ? (
            <Image source={{ uri: photoPublicUrl(p.storage_path) }} style={{ width: '100%', height: '100%' }} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

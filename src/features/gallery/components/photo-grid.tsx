import { Image, Pressable, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { Photo } from '@/types/db';
import { photoPublicUrl } from '../upload';

// 목업 `.photo-grid`(3열 정사각). 이미지 격자 = 카드그리드 금지의 예외(DESIGN.md).
// 선택 모드: selectionMode가 켜지면 탭이 뷰어 오픈 대신 선택 토글이 되고, 우상단에 체크 원형이
// 뜬다. 꺼진 평상시엔 기존대로 onPressPhoto로 뷰어를 연다(하위호환).
export function PhotoGrid({
  photos, onPressPhoto, selectionMode = false, selectedIds, onToggleSelect,
}: {
  photos: Photo[];
  onPressPhoto: (photo: Photo) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (photo: Photo) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {photos.map((p) => {
        const selected = selectionMode && !!selectedIds?.has(p.id);
        return (
          <Pressable
            key={p.id}
            onPress={() => (selectionMode ? onToggleSelect?.(p) : onPressPhoto(p))}
            accessibilityRole={selectionMode ? 'checkbox' : 'button'}
            accessibilityState={selectionMode ? { checked: selected } : undefined}
            accessibilityLabel={selectionMode ? '사진 선택' : '사진 보기'}
            style={{
              width: '31.3%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden',
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? colors.sage : colors.line,
              backgroundColor: colors.groundDeep,
            }}
          >
            {p.storage_path ? (
              <Image
                source={{ uri: photoPublicUrl(p.storage_path) }}
                style={{ width: '100%', height: '100%', opacity: selected ? 0.85 : 1 }}
              />
            ) : null}
            {selectionMode ? <SelectBadge selected={selected} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// 썸네일 우상단 선택 표시. 선택 시 sage 채움+흰 체크, 미선택 시 반투명 흰 테두리 원.
function SelectBadge({ selected }: { selected: boolean }) {
  return (
    <View
      style={{
        position: 'absolute', top: spacing.xs, right: spacing.xs,
        width: 22, height: 22, borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? colors.sage : 'rgba(255,255,255,0.9)',
        backgroundColor: selected ? colors.sage : 'rgba(0,0,0,0.25)',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {selected ? (
        <View style={{ width: 9, height: 5, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: colors.surface, transform: [{ rotate: '-45deg' }], marginTop: -2 }} />
      ) : null}
    </View>
  );
}

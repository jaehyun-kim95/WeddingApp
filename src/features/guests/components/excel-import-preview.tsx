import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import type { ImportGuestRow } from '../api';
import type { RowError } from '../types';

// 엑셀 가져오기 미리보기 모달 — "유효 N건 / 오류 M건" 요약 + 오류 행(행번호+사유) 리스트.
// "저장"은 valid만 import(오류 행은 건너뜀), "취소"는 아무것도 반영하지 않는다.
export function ExcelImportPreview({
  visible, valid, errors, onConfirm, onClose,
}: {
  visible: boolean;
  valid: ImportGuestRow[];
  errors: RowError[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '80%', marginHorizontal: layout.screenPadding, backgroundColor: colors.surface,
            borderRadius: radius.lg, padding: layout.screenPadding, gap: spacing.md,
          }}
        >
          <Text variant="title">엑셀 가져오기 미리보기</Text>
          <Text variant="body" color="ink">
            유효 <Text variant="body" color="sageInk">{valid.length}건</Text>
            {' '}/ 오류 <Text variant="body" color={errors.length > 0 ? 'blushInk' : 'ink'}>{errors.length}건</Text>
          </Text>

          {errors.length > 0 ? (
            <ScrollView style={{ maxHeight: 220 }}>
              {errors.map((e, idx) => (
                <View
                  key={`${e.row}-${idx}`}
                  style={{ paddingVertical: spacing.xs, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.line }}
                >
                  <Text variant="caption" color="inkMuted">
                    {e.row}행 · {e.reason}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text variant="caption" color="inkMuted">오류 행이 없습니다.</Text>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" label="취소" onPress={onClose} />
            <Button label={`저장 (${valid.length}건)`} onPress={onConfirm} disabled={valid.length === 0} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}


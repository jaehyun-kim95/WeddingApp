import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { parseManInput, sanitizeManInput, wonToMan } from '@/lib/money';

// 예산(전체/영역) 인라인 편집 — 숫자(만원)만 받는 작은 모달. 탭 → 그 자리에서 고쳐 저장
// (사용자 결정 2026-11-10). 저장은 원 단위로 환산해 onSubmit에 넘긴다.
export function AmountEditModal({
  visible, title, initialWon, onSubmit, onClose,
}: {
  visible: boolean;
  title: string;
  initialWon: number;
  onSubmit: (won: number) => void;
  onClose: () => void;
}) {
  const [man, setMan] = useState(initialWon > 0 ? String(wonToMan(initialWon)) : '');

  const submit = () => {
    onSubmit(parseManInput(man));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            marginHorizontal: layout.screenPadding, backgroundColor: colors.ground,
            borderRadius: radius.lg, padding: layout.screenPadding, gap: spacing.md,
          }}
        >
          <Text variant="title">{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              value={man} onChangeText={(t) => setMan(sanitizeManInput(t))}
              keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.inkFaint}
              autoFocus
              style={{
                flex: 1, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
                paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink,
                fontSize: 18, textAlign: 'right',
              }}
            />
            <Text variant="body" color="inkMuted">만원</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" label="취소" onPress={onClose} />
            <Button label="저장" onPress={submit} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

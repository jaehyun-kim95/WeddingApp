import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { formatMan, parseManInput, sanitizeManInput, wonToMan } from '@/lib/money';
import { useUpdateMealPrice } from '../hooks';

// 식대 단가(1인) 인라인 편집 — amount-edit-modal.tsx(비용 feature)와 동일 패턴의 축소판.
// 탭하면 작은 모달로 만원 단위 입력, 저장 시 useUpdateMealPrice. 단가 0(미설정)이면 안내 문구.
export function MealPriceField({ priceWon }: { priceWon: number }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateMealPrice();

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="식대 단가 수정"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text variant="caption" color="inkMuted">
          {priceWon > 0 ? `식대 단가 ${formatMan(priceWon)} · 탭하여 수정` : '식대 단가 미설정 · 탭하여 설정'}
        </Text>
      </Pressable>

      <MealPriceModal
        visible={open}
        initialWon={priceWon}
        onSubmit={(won) => { setOpen(false); update.mutate({ amount: won }); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function MealPriceModal({
  visible, initialWon, onSubmit, onClose,
}: {
  visible: boolean;
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
          <Text variant="title">식대 단가(1인)</Text>
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

import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors, layout, radius, shadow, spacing } from '@/constants/theme';

// 선택 모드에서 1장 이상 고르면 뜨는 하단 액션바. Fab과 같은 '중앙 정렬 앱 폭' 기준으로 떠서
// 앱 폭 내부 하단, 탭바/제스처 바 바로 위에 놓인다. 래퍼는 pointerEvents box-none(터치 통과),
// 카드만 눌린다. bottomInset은 탭 밖 push 화면(갤러리)에서 useSafeAreaInsets().bottom을 넘긴다
// (Fab과 동일 패턴).
export function SelectionActionBar({
  count, busy, onSave, onShare, bottomInset = 0,
}: {
  count: number;
  busy: boolean;
  onSave: () => void;
  onShare: () => void;
  bottomInset?: number;
}) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View pointerEvents="box-none" style={[styles.inner, { paddingBottom: spacing.md + bottomInset }]}>
        <View style={styles.card}>
          <Text variant="bodySm" color="ink">{count}장 선택</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" label={busy ? '처리 중...' : '저장'} onPress={onSave} disabled={busy} />
            <Button label={busy ? '처리 중...' : '공유'} onPress={onShare} disabled={busy} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  inner: {
    width: '100%',
    maxWidth: layout.appMaxWidth,
    paddingHorizontal: layout.screenPadding,
    alignItems: 'stretch',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadow.ambientShell,
  },
});

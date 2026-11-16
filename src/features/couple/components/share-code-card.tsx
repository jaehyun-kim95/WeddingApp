import * as Clipboard from 'expo-clipboard';
import { Alert, Share, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';

// design/settings.html의 `.share-card` — 무그림자 surface 패널(달력 패널과 동일한 예외, DESIGN.md).
// 재발급은 파괴적(기존 코드가 즉시 무효화돼 상대방 세션이 끊긴다, ADR-0008) — 확인 다이얼로그를
// 반드시 거친다.
export function ShareCodeCard({
  shareCode, onRegenerate, regenerating,
}: { shareCode: string; onRegenerate: () => void; regenerating: boolean }) {
  const copy = async () => {
    await Clipboard.setStringAsync(shareCode);
    Alert.alert('복사했어요', '공유 코드가 클립보드에 복사됐습니다.');
  };

  const invite = () => {
    Share.share({ message: `우리 결혼 준비 공유 코드: ${shareCode}` });
  };

  const confirmRegenerate = () => {
    Alert.alert(
      '코드를 새로 발급할까요?',
      '재발급하면 기존 코드로 접속 중인 상대방은 새 코드를 다시 입력해야 합니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '새로 발급', style: 'destructive', onPress: onRegenerate },
      ],
    );
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="caption" color="inkMuted">공유 코드</Text>
        <Button variant="ghost" label="복사" onPress={copy} />
      </View>
      {/* 실제 코드는 24자 hex라 목업의 짧은 포맷(WED-7K2M-9QX) 가정 폰트 크기로는 버튼을 화면
          밖으로 밀어낸다(사용자 실기기 리포트, 2026-11-16) — 복사 버튼과 같은 줄에 두지 않고
          코드를 전체 너비로 분리해, 길어도 줄바꿈만 될 뿐 레이아웃이 깨지지 않게 한다. */}
      <Text variant="titleSm" tabularNums color="ink" style={{ marginTop: spacing.sm, letterSpacing: 0.4 }}>
        {shareCode}
      </Text>
      <Text variant="caption" color="inkMuted" style={{ marginTop: spacing.md, lineHeight: 18 }}>
        애인이 이 코드를 입력하면 로그인 없이 같은 공용 저장소에 접속해 같은 데이터를 함께 쓸 수 있어요.
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Button variant="ghost" label="링크로 초대" onPress={invite} style={{ flex: 1 }} />
        <Button variant="ghost" label="코드 새로 발급" onPress={confirmRegenerate} disabled={regenerating} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

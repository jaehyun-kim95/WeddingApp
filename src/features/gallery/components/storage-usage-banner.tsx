import { View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { formatBytes } from '@/lib/bytes';

// 목업 `.gallery-top`에서 "영상" 칸만 뺀 2칸(전체 장수·원본 보관 용량, 설계 스펙 결정 1) +
// 80% 이상이면 경고 배너(설계 스펙 결정 3).
export function StorageUsageBanner({
  count, totalBytes, nearLimit,
}: { count: number; totalBytes: number; nearLimit: boolean }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="inkMuted">전체</Text>
          <Text variant="stat" tabularNums>{count}장</Text>
        </View>
        <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: spacing.lg }}>
          <Text variant="caption" color="inkMuted">원본 보관</Text>
          <Text variant="stat" tabularNums>{formatBytes(totalBytes)}</Text>
        </View>
      </View>
      {nearLimit ? (
        <View
          style={{
            marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md,
            backgroundColor: colors.blushSoft,
          }}
        >
          <Text variant="bodySm" color="blushInk">
            무료 저장 용량(1GB)의 80%를 넘었어요. 사진이 더 쌓이면 보관 방법을 다시 정해야 해요.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

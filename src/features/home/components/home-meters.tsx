import { View } from 'react-native';

import { Meter, Text } from '@/components/ui';
import { spacing } from '@/constants/theme';

// 전체 준비 진행(체크리스트 overallPercent, 세이지) + 지출 진행률(budget spentRate=실지출÷약정,
// 블러시) 미터 2개. "지출 진행률"은 비용 화면 BudgetSummary와 같은 값·같은 라벨 — design/home.html
// 목업의 "예산 소비율"이라는 옛 이름을 쓰면 다른 지표(budgetRate=약정÷예산, 참고자료로 격하됨)로
// 오해하기 쉬워 비용 화면과 라벨을 맞췄다(사용자 지적 2026-11-11). 라벨+값 한 줄 + 얇은 미터, 세로로 쌓는다.
export function HomeMeters({
  progressPercent, spentRatePercent,
}: {
  progressPercent: number;
  spentRatePercent: number;
}) {
  return (
    <View>
      <MeterRow label="전체 준비 진행" percent={progressPercent} color="sage" />
      <View style={{ marginTop: spacing.lg }}>
        <MeterRow label="지출 진행률" percent={spentRatePercent} color="blush" />
      </View>
    </View>
  );
}

function MeterRow({ label, percent, color }: { label: string; percent: number; color: 'sage' | 'blush' }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="meta" color="inkMuted">{label}</Text>
        <Text variant="bodySm" tabularNums>{percent}%</Text>
      </View>
      <Meter value={percent} color={color} height={6} />
    </View>
  );
}

import { View } from 'react-native';

import { Meter, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';

// 전체 준비 진행(체크리스트 overallPercent, 세이지) + 지출 진행률(budget spentRate=실지출÷약정,
// 블러시) 미터 2개. "지출 진행률"은 비용 화면 BudgetSummary와 같은 값·같은 라벨 — design/home.html
// 목업의 "예산 소비율"이라는 옛 이름을 쓰면 다른 지표(budgetRate=약정÷예산, 참고자료로 격하됨)로
// 오해하기 쉬워 비용 화면과 라벨을 맞췄다(사용자 지적 2026-11-11). 라벨+값 한 줄 + 얇은 미터, 세로로 쌓는다.
//
// 축의금 총액(giftTotalWon)은 미터 2개와 성격이 다르다 — 비율이 아니라 금액(수입)이고, 지출과
// 상계하지 않는 별도 표기라 진행률 바 없이 간결한 스탯 한 줄로만 아래에 둔다(사용자 결정:
// 하객 화면 + 홈 대시보드 둘 다 노출). 0이면(접수 전) "축의금 0"으로 자연스럽게 보임 — 접수 0건을
// 숨기지 않는 기존 빈 상태 패턴(formatMan(0) === '0')을 그대로 따른다.
export function HomeMeters({
  progressPercent, spentRatePercent, giftTotalWon,
}: {
  progressPercent: number;
  spentRatePercent: number;
  giftTotalWon: number;
}) {
  return (
    <View>
      <MeterRow label="전체 준비 진행" percent={progressPercent} color="sage" />
      <View style={{ marginTop: spacing.lg }}>
        <MeterRow label="지출 진행률" percent={spentRatePercent} color="blush" />
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
        marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line,
      }}>
        <Text variant="meta" color="inkMuted">축의금</Text>
        <Text variant="bodySm" tabularNums>{formatMan(giftTotalWon)}</Text>
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

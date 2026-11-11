import { View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

// D-day 센터피스(DESIGN.md 시그니처 컴포넌트) — 모든 화면 중 홈에만 등장하는 거대한 형태.
// "D-" 접두사(Subtitle 26px)와 숫자(Display 66px)를 같은 줄 베이스라인에 정렬, 모두 세리프·
// 블러시-잉크. 이 형태는 변형하지 않는다(DESIGN.md "변형하지 않는다" 규범).
// dday===0(예식일 당일)·음수(지난 뒤)는 DESIGN.md가 명시하지 않은 경계지만, budget.tsx의
// ddayLabel 선례(D-Day/D+N)를 같은 시각 문법으로 확장해 다룬다.
export function DdayCenterpiece({ dday }: { dday: number | null }) {
  if (dday === null) {
    return (
      <View style={{
        marginTop: spacing.xxxl, padding: spacing.lg,
        borderWidth: 1, borderColor: colors.lineStrong, borderStyle: 'dashed', borderRadius: 10,
      }}>
        <Text variant="caption" color="inkMuted">예식일을 아직 정하지 않으셨나요?</Text>
        <Text variant="body" color="inkMuted" style={{ marginTop: spacing.sm }}>
          설정에서 예식일을 등록하면 D-day가 여기 표시돼요.
        </Text>
      </View>
    );
  }

  if (dday === 0) {
    return (
      <View style={{ alignItems: 'center', marginTop: spacing.xxxl }}>
        <Text variant="display" color="blushInk" tabularNums>D-DAY</Text>
        <Text variant="meta" color="inkMuted" style={{ marginTop: spacing.sm }}>오늘, 예식일이에요</Text>
      </View>
    );
  }

  const prefix = dday > 0 ? 'D-' : 'D+';
  const n = Math.abs(dday);
  return (
    <View style={{ alignItems: 'center', marginTop: spacing.xxxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text variant="subtitle" color="blushInk">{prefix}</Text>
        <Text variant="display" color="blushInk" tabularNums>{n}</Text>
      </View>
      <Text variant="meta" color="inkMuted" style={{ marginTop: spacing.sm }}>예식일까지</Text>
    </View>
  );
}

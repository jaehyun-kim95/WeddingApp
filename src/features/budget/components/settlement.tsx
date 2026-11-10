import { View } from 'react-native';

import { Meter, Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { formatMan } from '@/lib/money';
import type { Payer } from '@/types/db';
import type { PayerSettlement } from '../types';

// "나/애인"은 보는 사람 입장에 따라 바뀌는 상대적 기준이라 같은 데이터를 신랑·신부 둘 다 보는 이
// 앱에서 혼동을 준다(사용자 결정 2026-11-10) — 절대적 명칭 "신랑/신부"로 표시한다. DB 값(ME/PARTNER)은
// 안 바꾸고 라벨만 바꾼다. payer=null은 "미지정"으로 노출(숨기지 않음).
const PAYER_LABEL: Record<Payer, string> = { ME: '신랑', PARTNER: '신부', BOTH_FAMILY: '양가' };
function payerLabel(payer: Payer | null): string {
  return payer === null ? '미지정' : PAYER_LABEL[payer];
}

// 분담 정산(신랑/신부/양가/미지정) — 실납부 기준(ADR-0004). 미터는 중립(웜그레이=inkMuted): 색은 예산
// 상태에만 쓰고(One-Axis Color Rule) 분담 주체는 이름+금액으로 구분한다.
export function Settlement({ rows }: { rows: PayerSettlement[] }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="title">분담 정산</Text>
        <Text variant="caption" color="inkMuted">지금까지 낸 금액</Text>
      </View>

      <View>
        {rows.map((r) => (
          <View
            key={r.payer ?? 'UNASSIGNED'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
          >
            <Text variant="bodySm" color={r.payer === null ? 'inkFaint' : 'ink'} style={{ width: 40 }}>{payerLabel(r.payer)}</Text>
            <View style={{ flex: 1 }}>
              <Meter value={r.percent} color="inkMuted" trackColor="line" height={5} />
            </View>
            <Text variant="bodySm" tabularNums>{formatMan(r.amount)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

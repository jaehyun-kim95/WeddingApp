import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { AreaAccordionItem, useAreaOverviews } from '@/features/areas';

// 네이티브 스택 헤더가 이미 "← 준비영역 모아보기" 제목+뒤로가기를 제공한다(_layout.tsx).
// 읽기 전용 집계 화면 — 새 쓰기 RPC 없음, 기존 도메인 셀렉터를 영역별로 묶어 보여주기만 한다.
export default function AreasScreen() {
  const { data: overviews = [] } = useAreaOverviews();
  // 목업처럼 첫 영역(sort_order 최솟값)만 기본 펼침, 나머지는 접힘. 여러 영역을 동시에 펼칠 수
  // 있어야 해(CSS 체크박스 트릭이 상호배타가 아니었다) Set으로 관리한다. overviews는 비동기로
  // 늦게 채워져 첫 렌더 땐 비어 있으므로, 데이터가 처음 도착한 순간에 한 번만 기본 펼침을 적용한다.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || overviews.length === 0) return;
    initialized.current = true;
    setExpanded(new Set([overviews[0].area.id]));
  }, [overviews]);
  const toggle = (areaId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xxxl }}>
        <Text variant="caption" color="inkMuted" style={{ marginTop: spacing.lg }}>
          영역별로 전부 모아 본다 · 눌러서 펼치기
        </Text>

        <View style={{ marginTop: spacing.md }}>
          {overviews.map((overview) => (
            <AreaAccordionItem
              key={overview.area.id}
              overview={overview}
              expanded={expanded.has(overview.area.id)}
              onToggle={() => toggle(overview.area.id)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

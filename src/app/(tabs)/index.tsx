import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import {
  CheckRow, overallPercent, useChecklist, useToggleChecklistItem,
} from '@/features/checklist';
import { useBudgetSummary } from '@/features/budget';
import { useCouple, useCoupleSnapshot } from '@/features/couple';
import { formatWeddingMeta, useUpcomingFeed } from '@/features/home';
import { DdayCenterpiece } from '@/features/home/components/dday-centerpiece';
import { HomeMeters } from '@/features/home/components/home-meters';
import { Masthead } from '@/features/home/components/masthead';
import { QuickNav, type QuickNavItem } from '@/features/home/components/quick-nav';
import {
  CalendarView, EventRow, selectDDay, selectMarkersByDate, todayDateString,
} from '@/features/schedule';
import { useAreas } from '@/hooks/use-areas';
import { useAuspiciousDays } from '@/hooks/use-auspicious-days';

// 홈 — 체크리스트·일정·비용 세 도메인의 집계 뷰(Phase 1 마지막 슬라이스). 고유 쓰기는 체크
// 토글뿐이고, 나머지는 각 도메인 셀렉터·컴포넌트를 조립만 한다.
export default function HomeScreen() {
  const router = useRouter();
  const { data: snapshot } = useCoupleSnapshot();
  const { data: couple } = useCouple();
  const { data: checklistItems = [] } = useChecklist();
  const { data: budgetSummary } = useBudgetSummary();
  const { data: areas = [] } = useAreas();
  const { data: auspiciousDays = [] } = useAuspiciousDays();
  const feed = useUpcomingFeed(4).data ?? [];
  const toggleChecklistItem = useToggleChecklistItem();

  const today = todayDateString();
  const events = snapshot?.schedule_events ?? [];
  const markersByDate = selectMarkersByDate(events);
  const auspiciousDates = new Set(auspiciousDays.map((d) => d.day));
  const dday = couple ? selectDDay(couple.wedding_date, today) : null;
  const metaLabel = couple ? formatWeddingMeta(couple) : null;
  const progressPercent = overallPercent(checklistItems);

  const quickNavItems: QuickNavItem[] = [
    { key: 'schedule', label: '일정', onPress: () => router.push('/schedule') },
    { key: 'checklist', label: '체크리스트', onPress: () => router.push('/checklist') },
    { key: 'budget', label: '비용', onPress: () => router.push('/budget') },
    { key: 'vendors', label: '업체', onPress: () => router.push('/vendors') },
    { key: 'guests', label: '하객', onPress: () => router.push('/guests') },
    { key: 'gallery', label: '갤러리', onPress: () => router.push('/gallery') },
    { key: 'areas', label: '준비영역', onPress: () => router.push('/areas') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: layout.tabBarHeight + 80 }}>
        <View style={{ paddingHorizontal: layout.screenPadding }}>
          {/* 헤더(이름·톱니)·D-day는 배경 위에 그대로 — 원래 승인된 목업·DESIGN.md "D-day 센터피스"
              규범대로 카드 없이 둔다(사용자 결정 2026-11-11 3차 — ①-C가 헤더까지 카드에 넣어 범위가
              과하게 넓었음). 대시보드(흰 카드)는 미터만 담아 "수치 요약" 역할로 좁힌다. */}
          <Masthead
            groomName={couple?.groom_name ?? ''}
            brideName={couple?.bride_name ?? ''}
            metaLabel={metaLabel}
            onPressSettings={() => router.push('/settings')}
          />

          <DdayCenterpiece dday={dday} />

          <View style={{
            marginTop: spacing.xxxl, backgroundColor: colors.surface, borderWidth: 1,
            borderColor: colors.lineStrong, borderRadius: radius.md, padding: spacing.lg,
          }}>
            <HomeMeters
              progressPercent={progressPercent}
              spentRatePercent={budgetSummary?.spentRate ?? 0}
            />
          </View>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <QuickNav items={quickNavItems} />
        </View>

        {/* "다가오는 일정·할 일" 하나의 섹션으로 미니 캘린더+통합 리스트를 묶는다(사용자 피드백
            2026-11-11 2차 — 바로가기 다음에 캘린더가 제목 없이 바로 나와 구성이 모호했음). */}
        <View style={{ paddingHorizontal: layout.screenPadding }}>
          <View style={{ marginTop: spacing.xxxl }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text variant="title">다가오는 일정·할 일</Text>
              <Pressable onPress={() => router.push('/schedule')} hitSlop={8} accessibilityRole="button" accessibilityLabel="일정 전체 보기">
                <Text variant="meta" color="blushInk">전체 보기</Text>
              </Pressable>
            </View>

            <CalendarView
              selectedDate={today}
              onSelectDate={() => router.push('/schedule')}
              markersByDate={markersByDate}
              auspiciousDates={couple?.show_auspicious_days ? auspiciousDates : new Set()}
              todayStr={today}
              readOnly
            />
          </View>

          <View style={{ marginTop: spacing.xxl }}>
            {feed.length === 0 ? (
              <Text variant="body" color="inkMuted">다가오는 일정·할 일이 없습니다.</Text>
            ) : (
              feed.map((f, idx) => (f.kind === 'CHECKLIST' ? (
                <CheckRow
                  key={`c-${f.item.id}`}
                  item={f.item}
                  first={idx === 0}
                  onToggle={() => toggleChecklistItem.mutate({ id: f.item.id, isDone: !f.item.is_done })}
                  onEdit={() => router.push('/checklist')}
                />
              ) : (
                <EventRow
                  key={`e-${f.item.id}`}
                  item={f.item}
                  first={idx === 0}
                  areas={areas}
                  onPress={() => router.push('/schedule')}
                />
              )))
            )}
            <Button
              label="할 일 추가"
              variant="ghost"
              onPress={() => router.push('/checklist')}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

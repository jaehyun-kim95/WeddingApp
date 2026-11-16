import type { ReactNode } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip, ListRow, Meter, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { CheckRow } from '@/features/checklist/components/check-row';
import { EventRow } from '@/features/schedule/components/event-row';
import { toTimelineItem } from '@/features/schedule/api';
import { photoPublicUrl } from '@/features/gallery';
import { formatMan } from '@/lib/money';
import type { AreaOverview } from '../types';

// design/areas.html의 `.area-block` 1개 = 아코디언 헤더(영역명+진행률%+미터+카운트) + 상세(미니 섹션
// 5종). 목업의 순수 CSS 체크박스 트릭(:checked ~ 형제 선택자)은 RN에 옮길 수 없어 펼침 상태를
// 화면(상위)이 Set<string>으로 들고 내려준다 — 여러 영역을 동시에 펼칠 수 있어야 한다(상호배타 아님).
export function AreaAccordionItem({
  overview, expanded, onToggle,
}: { overview: AreaOverview; expanded: boolean; onToggle: () => void }) {
  const router = useRouter();
  const { area, checklist, schedule, vendor, cost, guestSummary, photos } = overview;
  const incomplete = checklist.items.filter((i) => !i.is_done);
  const vendors = [...vendor.contracted, ...vendor.candidates];

  const meterValue = cost && cost.budget > 0 ? Math.min(100, Math.round((cost.committed / cost.budget) * 100)) : 0;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.lg }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.sm }}
      >
        <Text variant="titleSm" style={{ flex: 1 }}>{area.name_ko}</Text>
        <Text variant="bodySm" color="sageInk" tabularNums>{checklist.percent}%</Text>
        <Text variant="bodySm" color="inkMuted">{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      <Meter value={checklist.percent} style={{ marginBottom: spacing.md }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.lg }}>
        <Stat label="할 일" value={String(incomplete.length)} />
        <Stat label="일정" value={String(schedule.length)} />
        <Stat label="업체" value={String(vendors.length)} />
        {guestSummary ? (
          <Stat label="축의" value={`${formatMan(guestSummary.giftTotal)}`} />
        ) : cost ? (
          <Stat label="비용" value={`${formatMan(cost.committed)}/${cost.budget > 0 ? formatMan(cost.budget) : '미설정'}`} />
        ) : null}
        <Stat label="사진" value={String(photos.length)} />
      </View>

      {expanded ? (
        <View style={{ paddingBottom: spacing.xl, gap: spacing.xl }}>
          <MiniSection title={`할 일 · 미완료 ${incomplete.length}`} onSeeAll={() => router.push('/checklist')}>
            {incomplete.length === 0 ? (
              <Text variant="caption" color="inkMuted">할 일이 모두 끝났어요.</Text>
            ) : (
              incomplete.map((item, i) => (
                <CheckRow key={item.id} item={item} first={i === 0} onToggle={() => {}} onEdit={() => router.push('/checklist')} />
              ))
            )}
          </MiniSection>

          <MiniSection title={schedule.length > 0 ? `일정 · 다가오는 ${schedule.length}` : '일정'} onSeeAll={() => router.push('/schedule')}>
            {schedule.length === 0 ? (
              <Text variant="caption" color="inkMuted">예정된 일정이 없어요.</Text>
            ) : (
              schedule.map((e, i) => (
                <EventRow key={e.id} item={toTimelineItem(e)} first={i === 0} areas={[]} onPress={() => router.push('/schedule')} />
              ))
            )}
          </MiniSection>

          <MiniSection
            title={`업체 · 계약 ${vendor.contracted.length} · 후보 ${vendor.candidates.length}`}
            onSeeAll={() => router.push('/vendors')}
          >
            {vendors.length === 0 ? (
              <Text variant="caption" color="inkMuted">등록된 업체가 없어요.</Text>
            ) : (
              vendors.map((v, i) => (
                <ListRow
                  key={v.id}
                  title={v.name}
                  subtitle={v.location ?? undefined}
                  first={i === 0}
                  onPress={() => router.push('/vendors')}
                  left={<Chip variant={v.status === 'CONTRACTED' ? 'plan' : 'ghost'} label={v.status === 'CONTRACTED' ? '계약' : '후보'} />}
                  right={v.quoted_price != null ? <Text variant="titleSm" tabularNums>{formatMan(v.quoted_price)}</Text> : undefined}
                />
              ))
            )}
          </MiniSection>

          {guestSummary ? (
            <MiniSection title="하객 · 명단" onSeeAll={() => router.push('/guests')}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodySm" color="inkMuted">
                  하객 <Text variant="bodySm" tabularNums>{guestSummary.total}</Text>명 · 식사 {guestSummary.mealCount}
                </Text>
                <Text variant="bodySm" tabularNums>축의 {formatMan(guestSummary.giftTotal)}</Text>
              </View>
            </MiniSection>
          ) : cost ? (
            <MiniSection title="비용" onSeeAll={() => router.push('/budget')}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodySm" color={cost.isOver ? 'terracottaInk' : 'ink'} tabularNums>
                  약정 {formatMan(cost.committed)} / 예산 {cost.budget > 0 ? formatMan(cost.budget) : '미설정'}
                </Text>
                <Text variant="caption" color="inkMuted">
                  잔여 {formatMan(Math.max(cost.budget - cost.committed, 0))}
                </Text>
              </View>
              <Meter value={meterValue} color={cost.isOver ? 'terracotta' : 'blush'} trackColor="groundDeep" height={6} style={{ marginTop: spacing.sm }} />
            </MiniSection>
          ) : null}

          <MiniSection title={`사진 · ${photos.length}장`} onSeeAll={() => router.push('/gallery')}>
            {photos.length === 0 ? (
              <Text variant="caption" color="inkMuted">아직 사진이 없어요.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {photos.slice(0, 8).map((p) => (
                    <View key={p.id} style={{ width: 64, height: 64, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
                      {p.storage_path ? (
                        <Image source={{ uri: photoPublicUrl(p.storage_path) }} style={{ width: '100%', height: '100%' }} />
                      ) : null}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </MiniSection>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Text variant="caption" color="inkMuted">
      {label} <Text variant="caption" color="ink" tabularNums>{value}</Text>
    </Text>
  );
}

function MiniSection({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="label" color="ink">{title}</Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text variant="caption" color="blushInk">전체 →</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

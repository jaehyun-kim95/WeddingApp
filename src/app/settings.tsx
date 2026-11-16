import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Switch, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import {
  ShareCodeCard, WeddingInfoForm, useCouple, useRegenerateShareCode, useUpdateCouple,
} from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';

// 네이티브 스택 헤더가 이미 "← 설정" 제목+뒤로가기를 제공한다(_layout.tsx).
// design/settings.html의 4그룹 중 결혼정보+애인과 공유+표시(납부일 알림만) 3그룹만 구현한다.
// "데이터"(표준 시드/백업) 그룹은 아직 동작이 없어 제외(다음 세션) — 동작 안 하는 행을 보여주지 않는다.
// "길일 표시" 토글도 제외(데이터 없음, 사용자 결정) — Phase 3 모아보기+설정 계획 범위 밖.
export default function SettingsScreen() {
  const { data: couple } = useCouple();
  const { shareCode } = useShareCode();
  const updateCouple = useUpdateCouple();
  const regenerate = useRegenerateShareCode();
  const [infoFormOpen, setInfoFormOpen] = useState(false);

  if (!couple || !shareCode) return null;

  const undecided = couple.wedding_date_status !== 'FIXED';

  const toggleUndecided = (next: boolean) => {
    // 미정→확정으로 끄려는데 날짜가 아직 없으면 그대로 저장할 수 없다(couple_fixed_has_date 체크
    // 제약) — 대신 편집 모달을 열어 날짜를 고르게 한다.
    if (!next && couple.wedding_date === null) {
      setInfoFormOpen(true);
      return;
    }
    updateCouple.mutate({
      groomName: couple.groom_name,
      brideName: couple.bride_name,
      weddingDate: couple.wedding_date,
      weddingDateStatus: next ? 'UNDECIDED' : 'FIXED',
      weddingTime: couple.wedding_time,
      venue: couple.venue,
      notifyPayments: couple.notify_payments,
    });
  };

  const toggleNotifyPayments = (next: boolean) => {
    updateCouple.mutate({
      groomName: couple.groom_name,
      brideName: couple.bride_name,
      weddingDate: couple.wedding_date,
      weddingDateStatus: couple.wedding_date_status,
      weddingTime: couple.wedding_time,
      venue: couple.venue,
      notifyPayments: next,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Group title="결혼 정보">
          <RowList>
            <ListRow first title="두 사람" onPress={() => setInfoFormOpen(true)}
              right={<Text variant="bodySm" color="inkMuted">{couple.groom_name} & {couple.bride_name}</Text>} />
            <ListRow title="예식 날짜" onPress={() => setInfoFormOpen(true)}
              right={<Text variant="bodySm" color="inkMuted">{undecided ? '아직 미정' : couple.wedding_date}</Text>} />
            <ListRow title="예식 장소" onPress={() => setInfoFormOpen(true)}
              right={<Text variant="bodySm" color="inkMuted">{couple.venue ?? '아직 미정'}</Text>} />
            <ListRow
              title="날짜 미정 모드"
              subtitle="날짜를 정하기 전까지 D-day를 숨긴다"
              right={<Switch value={undecided} onValueChange={toggleUndecided} />}
            />
          </RowList>
        </Group>

        <Group title="애인과 공유">
          <ShareCodeCard
            shareCode={shareCode}
            regenerating={regenerate.isPending}
            onRegenerate={() => regenerate.mutate()}
          />
        </Group>

        <Group title="표시">
          <RowList>
            <ListRow
              first
              title="납부일 알림"
              subtitle="업체 예약금·잔금 납부일 알림"
              right={<Switch value={couple.notify_payments} onValueChange={toggleNotifyPayments} />}
            />
          </RowList>
        </Group>

        <Text variant="caption" color="inkMuted" style={{ textAlign: 'center', marginTop: spacing.xxxl }}>
          결혼 준비 · 우리 둘의 기록
        </Text>
      </ScrollView>

      <WeddingInfoForm
        visible={infoFormOpen}
        couple={couple}
        onSubmit={(v) => { updateCouple.mutate(v); setInfoFormOpen(false); }}
        onClose={() => setInfoFormOpen(false)}
      />
    </SafeAreaView>
  );
}

// design/settings.html `.set-group` — 소제목 + 그룹 콘텐츠. 리스트 그룹(.set-list)만 헤어라인
// 프레임(RowList)을 두르고, 공유 카드(.share-card)는 이미 자체 패널 모양이라 두르지 않는다.
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text variant="label" color="inkMuted" style={{ marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );
}

function RowList({ children }: { children: ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, paddingHorizontal: spacing.lg }}>
      {children}
    </View>
  );
}

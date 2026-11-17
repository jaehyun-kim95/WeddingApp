import type { ReactNode } from 'react';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Switch, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import {
  ShareCodeCard, WeddingInfoForm, useCouple, useCoupleSnapshot, useRegenerateShareCode, useUpdateCouple,
} from '@/features/couple';
import {
  BackupImportPreview, exportBackup, pickAndParseBackup, useRestoreBackup,
  type BackupData,
} from '@/features/backup';
import { useAreas } from '@/hooks/use-areas';
import { useShareCode } from '@/providers/share-code-provider';

// 네이티브 스택 헤더가 이미 "← 설정" 제목+뒤로가기를 제공한다(_layout.tsx).
// design/settings.html의 4그룹 중 결혼정보+애인과 공유+데이터(백업)+표시(납부일 알림만)를 구현한다.
// "데이터" 그룹은 백업 내보내기/가져오기 2행만(표준 시드 불러오기는 콘텐츠 미작성이라 이번 범위 밖).
// "길일 표시" 토글도 제외(데이터 없음, 사용자 결정) — Phase 3 모아보기+설정 계획 범위 밖.
export default function SettingsScreen() {
  const { data: couple } = useCouple();
  const { data: snapshot } = useCoupleSnapshot();
  const { data: areas = [] } = useAreas();
  const { shareCode } = useShareCode();
  const updateCouple = useUpdateCouple();
  const regenerate = useRegenerateShareCode();
  const restore = useRestoreBackup();
  const [infoFormOpen, setInfoFormOpen] = useState(false);
  // 가져오기 미리보기 모달 상태 — 파싱 성공(ok) 시 data/warnings를 담아 연다.
  const [importPreview, setImportPreview] = useState<{ data: BackupData; warnings: string[]; exportedAt: string } | null>(null);

  if (!couple || !shareCode) return null;

  const onExport = async () => {
    if (!snapshot) return;
    try {
      await exportBackup(snapshot, areas);
    } catch (e) {
      Alert.alert('내보내지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const onImport = async () => {
    let result;
    try {
      result = await pickAndParseBackup();
    } catch (e) {
      Alert.alert('파일을 열지 못했습니다', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
      return;
    }
    if (result === null) return; // 사용자가 취소
    if (!result.ok) {
      Alert.alert('가져올 수 없는 파일입니다', IMPORT_FAIL_MESSAGE[result.reason]);
      return;
    }
    setImportPreview({
      data: result.file.data,
      warnings: result.warnings,
      exportedAt: result.file.exported_at,
    });
  };

  const onConfirmImport = () => {
    if (!importPreview) return;
    restore.mutate(importPreview.data, {
      onSuccess: () => setImportPreview(null),
    });
  };

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

        <Group title="데이터">
          <RowList>
            <ListRow
              first
              title="백업 내보내기"
              subtitle="전체 데이터를 파일로 저장"
              onPress={onExport}
              right={<Text variant="bodySm" color="inkMuted">›</Text>}
            />
            <ListRow
              title="백업 가져오기"
              subtitle="파일에서 복원 (기존 데이터 덮어쓰기)"
              onPress={onImport}
              right={<Text variant="bodySm" color="inkMuted">›</Text>}
            />
          </RowList>
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

      <BackupImportPreview
        visible={importPreview !== null}
        data={importPreview?.data ?? null}
        warnings={importPreview?.warnings ?? []}
        exportedAt={importPreview?.exportedAt}
        pending={restore.isPending}
        onConfirm={onConfirmImport}
        onClose={() => { if (!restore.isPending) setImportPreview(null); }}
      />
    </SafeAreaView>
  );
}

// parseBackup 실패 사유별 사용자 안내 문구.
const IMPORT_FAIL_MESSAGE: Record<'NOT_BACKUP' | 'VERSION_TOO_NEW' | 'VERSION_TOO_OLD' | 'MALFORMED', string> = {
  NOT_BACKUP: '이 앱의 백업 파일이 아닙니다. wedding-backup-*.json 파일을 선택해 주세요.',
  VERSION_TOO_NEW: '더 새로운 버전에서 만든 백업입니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.',
  VERSION_TOO_OLD: '너무 오래된 형식의 백업이라 읽을 수 없습니다.',
  MALFORMED: '백업 파일이 손상되었거나 형식이 올바르지 않습니다.',
};

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

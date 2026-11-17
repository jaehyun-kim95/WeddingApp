import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { ARRAY_TABLE_KEYS, countRows, TABLE_LABEL, type BackupData } from '../backup-format';

// 백업 가져오기 미리보기 모달(ExcelImportPreview 구조 복제). 테이블별 건수 요약 + 파괴적 경고
// ("기존 데이터를 모두 덮어씁니다") + 버전 변환 warnings. 확인 버튼은 파괴적 스타일("덮어쓰기").
export function BackupImportPreview({
  visible, data, warnings, exportedAt, onConfirm, onClose, pending = false,
}: {
  visible: boolean;
  data: BackupData | null;
  warnings: string[];
  exportedAt?: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const counts = data ? countRows(data) : null;
  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '80%', marginHorizontal: layout.screenPadding, backgroundColor: colors.surface,
            borderRadius: radius.lg, padding: layout.screenPadding, gap: spacing.md,
          }}
        >
          <Text variant="title">백업 가져오기</Text>

          {/* 파괴적 경고 — 복원은 현재 데이터를 영구 삭제한다(ADR-0009). */}
          <View style={{ backgroundColor: colors.terracottaSoft, borderRadius: radius.md, padding: spacing.md }}>
            <Text variant="bodySm" color="terracottaInk">
              기존 데이터를 모두 덮어씁니다. 지금의 데이터는 사라지고 백업 내용으로 완전히 교체됩니다.
            </Text>
          </View>

          {exportedAt ? (
            <Text variant="caption" color="inkMuted">
              내보낸 시각: {formatExportedAt(exportedAt)}
            </Text>
          ) : null}

          {counts ? (
            <ScrollView style={{ maxHeight: 240 }}>
              {ARRAY_TABLE_KEYS.map((key, idx) => (
                <View
                  key={key}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs,
                    borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.line,
                  }}
                >
                  <Text variant="body" color="ink">{TABLE_LABEL[key]}</Text>
                  <Text variant="bodySm" color="inkMuted">{counts[key]}건</Text>
                </View>
              ))}
              <View
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm,
                  borderTopWidth: 1, borderTopColor: colors.lineStrong,
                }}
              >
                <Text variant="bodySm" color="ink">합계</Text>
                <Text variant="bodySm" color="ink">{total}건</Text>
              </View>
            </ScrollView>
          ) : null}

          {warnings.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              {warnings.map((w, idx) => (
                <Text key={idx} variant="caption" color="terracottaInk">· {w}</Text>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" label="취소" onPress={onClose} disabled={pending} />
            <Button
              label={pending ? '덮어쓰는 중…' : '덮어쓰기'}
              onPress={onConfirm}
              disabled={pending || !data}
              style={{ backgroundColor: colors.terracotta }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ISO 문자열을 YYYY-MM-DD HH:mm으로 표시(간단 로컬 표기). 빈/파싱 불가 시 원문 그대로.
function formatExportedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

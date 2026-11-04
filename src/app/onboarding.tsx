import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { colors, fonts, layout, radius, spacing } from '@/constants/theme';
import { createCouple, getCoupleSnapshot, ShareCodeInvalidError } from '@/lib/rpc';
import { normalizeShareCode } from '@/lib/share-code';
import { useShareCode } from '@/providers/share-code-provider';

type Mode = 'choose' | 'create' | 'join';

// 온보딩(흐름도 01). 새로 시작=커플 생성·코드 발급, 기존 참여=코드 입력·검증. 성공 시 코드를 저장하면
// RootNav가 ready를 감지해 앱으로 이동한다. 상세 입력(날짜·장소 등)은 Phase 1 설정에서 보강.
export default function OnboardingScreen() {
  const { save } = useShareCode();
  const [mode, setMode] = useState<Mode>('choose');
  const [busy, setBusy] = useState(false);
  const [groom, setGroom] = useState('');
  const [bride, setBride] = useState('');
  const [code, setCode] = useState('');

  async function handleCreate() {
    if (!groom.trim() || !bride.trim()) {
      Alert.alert('이름을 입력해 주세요', '신랑·신부 이름이 필요합니다.');
      return;
    }
    setBusy(true);
    try {
      const newCode = await createCouple({
        groomName: groom.trim(),
        brideName: bride.trim(),
        weddingDateStatus: 'UNDECIDED',
      });
      await save(newCode);
    } catch (e) {
      Alert.alert('생성 실패', String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const raw = normalizeShareCode(code);
    if (!raw) {
      Alert.alert('코드를 입력해 주세요');
      return;
    }
    setBusy(true);
    try {
      await getCoupleSnapshot(raw); // 유효성 검증(무효면 ShareCodeInvalidError)
      await save(raw);
    } catch (e) {
      if (e instanceof ShareCodeInvalidError) {
        Alert.alert('유효하지 않은 코드', '공유 코드를 다시 확인해 주세요.');
      } else {
        Alert.alert('접속 실패', String((e as Error).message));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: layout.screenPadding, justifyContent: 'center', gap: spacing.xxl }}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="headline" color="ink">
              우리 결혼 준비
            </Text>
            <Text variant="meta" color="inkMuted">
              둘이 공유 코드 하나로 함께 씁니다.
            </Text>
          </View>

          {mode === 'choose' ? (
            <View style={{ gap: spacing.md }}>
              <Button label="새로 시작하기" onPress={() => setMode('create')} />
              <Button label="기존 코드로 참여" variant="ghost" onPress={() => setMode('join')} />
            </View>
          ) : null}

          {mode === 'create' ? (
            <View style={{ gap: spacing.md }}>
              <Field placeholder="신랑 이름" value={groom} onChangeText={setGroom} />
              <Field placeholder="신부 이름" value={bride} onChangeText={setBride} />
              <Button label={busy ? '생성 중…' : '시작하기'} disabled={busy} onPress={handleCreate} />
              <Button label="뒤로" variant="ghost" disabled={busy} onPress={() => setMode('choose')} />
            </View>
          ) : null}

          {mode === 'join' ? (
            <View style={{ gap: spacing.md }}>
              <Field
                placeholder="공유 코드 입력"
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button label={busy ? '확인 중…' : '참여하기'} disabled={busy} onPress={handleJoin} />
              <Button label="뒤로" variant="ghost" disabled={busy} onPress={() => setMode('choose')} />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// 간단 입력 필드 — 토큰 기반. 상세 폼 컴포넌트는 Phase 1에서 정리.
function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.inkFaint}
      style={{
        height: 48,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.lineStrong,
        backgroundColor: colors.surface,
        color: colors.ink,
        fontFamily: fonts.sans,
        fontSize: 15,
      }}
      {...props}
    />
  );
}

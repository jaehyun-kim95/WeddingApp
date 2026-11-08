import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { Text } from './text';
import { TimePicker } from './time-picker';

// 시간 입력을 텍스트 타이핑이 아니라 휠 스크롤 선택(TimePicker)으로 받는다(사용자 결정 2026-11-08
// — 자유 텍스트는 "15:00"처럼 형식을 지켜 입력해야 하는 부담과 오타 가능성이 있었다). DateField와
// 동일한 트리거 필드 패턴.
export type TimeFieldProps = {
  value: string | null; // 'HH:MM'
  onChange: (v: string | null) => void;
  placeholder: string;
};

export function TimeField({ value, onChange, placeholder }: TimeFieldProps) {
  const [show, setShow] = useState(false);
  // DateField와 같은 이유로 열 때마다 리마운트 — visible만 토글하면 TimePicker 내부 state가
  // 이전에 고르던 시/분에 멈춰 있다.
  const [pickerKey, setPickerKey] = useState(0);
  const open = () => { setPickerKey((k) => k + 1); setShow(true); };

  return (
    <>
      <View style={{ position: 'relative' }}>
        <Pressable onPress={open} style={[inputStyle, value ? { paddingRight: 56 } : null]}>
          <Text variant="body" color={value ? 'ink' : 'inkFaint'}>{value ?? placeholder}</Text>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange(null)} style={{ position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Text variant="caption" color="inkMuted">지우기</Text>
          </Pressable>
        ) : null}
      </View>
      <TimePicker
        key={pickerKey}
        visible={show}
        value={value}
        onSelect={(t) => { onChange(t); setShow(false); }}
        onClose={() => setShow(false)}
      />
    </>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;

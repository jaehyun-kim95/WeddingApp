import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { CalendarPicker } from './calendar-picker';
import { Text } from './text';

// 날짜 입력을 텍스트 타이핑이 아니라 커스텀 달력 선택(CalendarPicker)으로 받는다. 전에는 네이티브는
// @react-native-community/datetimepicker, 웹은 raw DOM <input type="date">로 플랫폼을 나눴지만, 둘 다
// OS/브라우저가 그리는 영역이라 "오늘" 표시를 우리 디자인대로 커스터마이즈할 수 없었다(실사용
// 피드백 — 연한 원으로 오늘을 표시해달라는 요청을 네이티브 피커로는 구현 불가). CalendarPicker는
// 순수 RN 컴포넌트라 플랫폼 구분 없이 동일하게 동작·스타일링된다.
// checklist·schedule 두 도메인이 공유하므로 components/ui(공용 계층)에 둔다.
export type DateFieldProps = {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
};

export function DateField({ value, onChange, placeholder }: DateFieldProps) {
  const [show, setShow] = useState(false);
  // 열 때마다 증가시켜 CalendarPicker를 리마운트한다 — visible만 토글하면 CalendarPicker 내부의
  // "보던 달" state가 전에 탐색하던 달에 멈춰 있어, 닫았다 다시 열면 오늘이 없는 엉뚱한 달이 보인다.
  const [calKey, setCalKey] = useState(0);
  const openCalendar = () => { setCalKey((k) => k + 1); setShow(true); };

  return (
    <>
      {/* 절대배치 "지우기"의 기준이 이 필드 자신이 되도록 relative 래퍼로 감싼다 — 감싸지 않으면
          RN이 더 바깥(모달 전체) 조상을 기준으로 위치를 잡아 엉뚱한 곳에 뜬다. */}
      <View style={{ position: 'relative' }}>
        <Pressable onPress={openCalendar} style={[inputStyle, value ? { paddingRight: 56 } : null]}>
          <Text variant="body" color={value ? 'ink' : 'inkFaint'}>{value ?? placeholder}</Text>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange(null)} style={{ position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Text variant="caption" color="inkMuted">지우기</Text>
          </Pressable>
        ) : null}
      </View>
      <CalendarPicker
        key={calKey}
        visible={show}
        value={value}
        onSelect={(d) => { onChange(d); setShow(false); }}
        onClose={() => setShow(false)}
      />
    </>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15,
} as const;

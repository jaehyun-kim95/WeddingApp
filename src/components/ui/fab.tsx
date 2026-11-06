import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout, radius, shadow } from '@/constants/theme';
import { Text } from './text';

// 플로팅 추가 버튼(화면 공유). DESIGN.md FAB 규범 — 탭바와 같은 '중앙 정렬 앱 폭' 기준으로 떠서
// 앱 폭 내부 우측 하단, 탭바 바로 위에 놓인다. 래퍼는 pointerEvents box-none(터치 통과), 버튼만
// 눌린다. 배경은 blush가 아니라 blushInk — 흰 라벨과 AA 대비 확보.
// 원형 "+" 아이콘 버튼으로 단순화(실사용 피드백 — 모든 화면의 FAB이 "추가" 동작이라 텍스트 라벨
// 없이도 의미가 분명함). `label`은 시각적으로 숨고 accessibilityLabel로만 쓰인다.
//
// 함정: 이 래퍼는 뷰포트 전체가 아니라 **화면 콘텐츠 영역**(SafeAreaView)에만 걸친다 — Expo Router
// Tabs는 [콘텐츠 영역][탭바]를 세로로 분할하므로 콘텐츠 영역의 bottom:0은 이미 탭바 바로 위다.
// 그래서 paddingBottom에 layout.tabBarHeight를 더하면 탭바 높이만큼 "이중으로" 띄워진다(실측으로
// 발견 — 전엔 의도한 "+8px"가 실제로는 "+72px"였다). 간격값만 준다.
const TAB_BAR_GAP = 6; // 5~10px 요구 범위 내 고정값 — spacing 스케일엔 맞는 단계가 없어 매직넘버로 둔다.

export type FabProps = {
  label: string;
  onPress?: () => void;
};

export function Fab({ label, onPress }: FabProps) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View pointerEvents="box-none" style={styles.inner}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
          <Text style={styles.plus}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  inner: {
    width: '100%',
    maxWidth: layout.appMaxWidth,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: TAB_BAR_GAP,
    alignItems: 'flex-end',
  },
  btn: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blushInk,
    ...shadow.ambientShell,
  },
  plus: {
    fontSize: 28,
    lineHeight: 28,
    color: colors.surface,
    marginTop: -2, // "+" 글리프 자체의 광학적 치우침 보정(시각적 수직 중앙)
  },
  pressed: { opacity: 0.9 },
});

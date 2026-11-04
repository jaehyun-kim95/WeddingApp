/**
 * 디자인 토큰 — DESIGN.md 디자인 시스템("청첩장 스위트")의 단일 출처를 RN으로 옮긴 것.
 *
 * 값의 진실은 프로젝트 루트 `DESIGN.md`(+ `.impeccable/design.json`)가 소유한다. 여기서는 그 값을
 * RN 표현(px 단위 lineHeight/letterSpacing, RN shadow 객체)으로 변환해 담기만 한다. 값이 어긋나면
 * DESIGN.md가 이긴다.
 *
 * 다크모드 미지원(사용자 확정 2026-11-04) — 비주얼 방향이 "따뜻한 오프화이트 단일 월드"로 확정돼
 * 다크 팔레트가 없다. 앱은 `useColorScheme`이 항상 light를 반환하고 app.json이 `userInterfaceStyle:
 * "light"`로 고정한다.
 *
 * 설계 근거: docs/superpowers/specs/2026-11-04-design-tokens-design.md
 */

// ──────────────────────────────────────────────────────────────────────────
// Colors — DESIGN.md 17종, 단일 팔레트. 채움/ink(AA 텍스트)/soft(연한 배경) 3톤 체계.
// ──────────────────────────────────────────────────────────────────────────
export const colors = {
  // Neutral — 바탕 오프화이트 램프 + 잉크 + 괘선
  ground: '#FBF7F4', // 앱 전역 배경
  groundDeep: '#F4ECE7', // 앱 바깥 캔버스·탭바 틴트
  surface: '#FFFFFF', // 패널·타일·달력(절제해서)
  ink: '#332F2C', // 본문 텍스트
  inkMuted: '#6B615B', // 보조/메타 (AA 통과 최저선)
  inkFaint: '#978C85', // 3차 장식(큰 글자 한정)
  line: '#ECE3DC', // 헤어라인
  lineStrong: '#DDD2C9', // 강한 괘선

  // Primary — 블러시 로즈 (지금·D-day·주 액션)
  blush: '#C97E9A', // 채움(장식)
  blushInk: '#9E466E', // 텍스트(AA)
  blushSoft: '#F6E7ED', // 연한 배경

  // Secondary — 세이지 그린 (진행·완료)
  sage: '#7E9270',
  sageInk: '#556B47',
  sageSoft: '#E9EEE3',

  // Tertiary — 뮤트 테라코타 (임박·길일)
  terracotta: '#B5603F',
  terracottaInk: '#9A4A2B',
  terracottaSoft: '#F7E6DD',
} as const;

export type ColorToken = keyof typeof colors;

// ──────────────────────────────────────────────────────────────────────────
// Fonts — @expo-google-fonts로 로드되는 "정확한 웨이트 패밀리명".
// RN은 각 웨이트를 독립 패밀리로 등록하므로(합성 weight 비신뢰), 토큰은 생성 패밀리명이
// 아니라 로드된 패밀리명을 그대로 가리킨다. 로딩은 use-app-fonts → _layout에서 수행한다.
// 로딩 전까지는 RN이 시스템 폰트로 폴백한다(동작 무해).
// ──────────────────────────────────────────────────────────────────────────
export const fonts = {
  serif: 'GowunBatang_700Bold', // 사람 이름·D-day·섹션 제목 — 세리프 토큰은 전부 700 (The Serif-for-Names Rule)
  sans: 'NotoSansKR_400Regular', // 산세리프 기본(400): 본문·메타·캡션
  sansMedium: 'NotoSansKR_500Medium', // 산세리프 중간(500): bodySm·label
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Typography — DESIGN.md 11단계 고정 스케일.
// lineHeight = round(fontSize × 배율) [RN은 px 절대값], letterSpacing = em × fontSize [px].
// 숫자 표시에는 사용처에서 fontVariant:['tabular-nums']를 추가로 적용한다(토큰 아님).
// ──────────────────────────────────────────────────────────────────────────
export const type = {
  display: { fontFamily: fonts.serif, fontSize: 66, fontWeight: 700, lineHeight: 63, letterSpacing: -1.32 },
  headline: { fontFamily: fonts.serif, fontSize: 30, fontWeight: 700, lineHeight: 35 },
  subtitle: { fontFamily: fonts.serif, fontSize: 26, fontWeight: 700, lineHeight: 31 },
  stat: { fontFamily: fonts.serif, fontSize: 22, fontWeight: 700, lineHeight: 24 },
  title: { fontFamily: fonts.serif, fontSize: 19, fontWeight: 700, lineHeight: 25 },
  titleSm: { fontFamily: fonts.serif, fontSize: 16, fontWeight: 700, lineHeight: 21 },
  body: { fontFamily: fonts.sans, fontSize: 15, fontWeight: 400, lineHeight: 23 },
  bodySm: { fontFamily: fonts.sansMedium, fontSize: 14, fontWeight: 500, lineHeight: 20 },
  meta: { fontFamily: fonts.sans, fontSize: 13, fontWeight: 400, lineHeight: 18 },
  caption: { fontFamily: fonts.sans, fontSize: 12, fontWeight: 400, lineHeight: 17 },
  label: { fontFamily: fonts.sansMedium, fontSize: 11, fontWeight: 500, lineHeight: 15, letterSpacing: 0.22 },
} as const;

export type TypeToken = keyof typeof type;

// ──────────────────────────────────────────────────────────────────────────
// Radius / Spacing — DESIGN.md Shapes(5단계+pill) / spacing(7단계)과 1:1.
// ──────────────────────────────────────────────────────────────────────────
export const radius = {
  sm: 6, // 포커스 링·체크박스 등 작은 통제 요소
  md: 10, // 일반 패널·날짜 셀
  lg: 14,
  tile: 16, // 바로가기 아이콘 타일
  shell: 18, // 앱 셸 바깥 윤곽(데스크톱 캔버스)
  pill: 999, // 칩·버튼·미터·세그먼트
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Layout — DESIGN.md Layout 절. 앱 셸 430px, 화면 좌우 패딩 20px, 섹션 간 32px, 탭바 64px.
// ──────────────────────────────────────────────────────────────────────────
export const layout = {
  appMaxWidth: 430,
  screenPadding: 20,
  sectionGap: 32,
  tabBarHeight: 64,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Shadow — DESIGN.md Shadow Vocabulary. CSS rgba(90,55,65,α) = #5A3741 + opacity.
// 이 시스템은 거의 평면적이다 — 구조 구분은 괘선이, 그림자는 이 둘(떠 있는 요소)뿐.
// RN: iOS는 shadow*, Android는 elevation을 함께 둔다.
// ──────────────────────────────────────────────────────────────────────────
export const shadow = {
  // 앱 셸 전체 윤곽(데스크톱 캔버스 위)
  ambientShell: {
    shadowColor: '#5A3741',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    shadowOpacity: 0.1,
    elevation: 8,
  },
  // 바로가기 아이콘 타일 등 떠 있는 작은 요소
  ambientTile: {
    shadowColor: '#5A3741',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.07,
    elevation: 2,
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────
// 레거시 (scaffold 데모 전용) — 아래는 Expo scaffold가 남긴 토큰이다.
// explore.tsx·index.tsx·app-tabs·hint-row·web-badge 등 곧 제거될 데모 파일만 참조한다.
// @deprecated 네비 뼈대 단계에서 데모 파일과 함께 삭제한다. 새 코드는 위의 토큰을 쓴다.
// ──────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

/** @deprecated scaffold 데모 전용. 새 코드는 `colors`를 쓴다. */
export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

/** @deprecated scaffold 데모 전용. */
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** @deprecated scaffold 데모 전용. 새 코드는 `fonts`를 쓴다. */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** @deprecated scaffold 데모 전용. 새 코드는 `spacing`을 쓴다. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** @deprecated scaffold 데모 전용. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/** @deprecated scaffold 데모 전용. 새 코드는 `layout.appMaxWidth`를 쓴다. */
export const MaxContentWidth = 800;

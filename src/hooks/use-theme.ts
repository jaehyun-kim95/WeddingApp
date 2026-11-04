import { Colors } from '@/constants/theme';

// 다크 미지원이라 항상 light 팔레트. (scaffold 데모 전용 레거시 — 공용 컴포넌트 단계에서
// 새 토큰 `colors`로 이관 예정.)
export function useTheme() {
  return Colors.light;
}

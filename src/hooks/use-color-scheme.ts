// 다크모드 미지원(사용자 확정 2026-11-04) — 비주얼 방향이 오프화이트 단일 월드로 확정돼
// 다크 팔레트가 없다. 기기 설정과 무관하게 항상 light를 반환한다.
export function useColorScheme(): 'light' {
  return 'light';
}

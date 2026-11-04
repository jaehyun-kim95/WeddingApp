import { GowunBatang_700Bold } from '@expo-google-fonts/gowun-batang';
import { NotoSansKR_400Regular, NotoSansKR_500Medium } from '@expo-google-fonts/noto-sans-kr';
import { useFonts } from 'expo-font';

// 디자인 시스템 폰트 로딩. 여기 넘기는 키 문자열이 곧 RN 패밀리 등록명이 되므로,
// theme.ts의 `fonts`(GowunBatang_700Bold / NotoSansKR_400Regular / NotoSansKR_500Medium)와
// 1:1로 일치해야 한다. DESIGN.md 기준 실제 쓰는 3개 웨이트만 로드한다(세리프 700, 산세리프 400/500).
// 반환: [loaded, error] — 루트 레이아웃이 이걸로 스플래시 유지/해제를 결정한다.
export function useAppFonts() {
  return useFonts({
    GowunBatang_700Bold,
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
  });
}

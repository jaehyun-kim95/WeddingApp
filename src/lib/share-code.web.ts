// 웹 폴백 — expo-secure-store는 웹 미지원이라 localStorage로 공유 코드를 보관한다.
// (이 앱은 주로 네이티브지만 `expo start --web` 프리뷰/개발을 위해 필요.)
const STORAGE_KEY = 'wedding.shareCode';

export async function saveShareCode(code: string): Promise<void> {
  localStorage.setItem(STORAGE_KEY, code);
}

export async function loadShareCode(): Promise<string | null> {
  return localStorage.getItem(STORAGE_KEY);
}

export async function clearShareCode(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
}

export { formatShareCode, normalizeShareCode } from './share-code-format';

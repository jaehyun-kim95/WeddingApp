import * as SecureStore from 'expo-secure-store';

// 공유 코드는 커플 데이터 접근의 유일한 열쇠(capability, ADR-0003)라 네이티브는 암호화 저장소에 보관한다.
// 웹(expo-secure-store 미지원)은 share-code.web.ts가 localStorage로 대신한다.
const STORAGE_KEY = 'wedding.shareCode';

export async function saveShareCode(code: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, code);
}

export async function loadShareCode(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEY);
}

export async function clearShareCode(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

export { formatShareCode, normalizeShareCode } from './share-code-format';

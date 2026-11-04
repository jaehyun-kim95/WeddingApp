import * as SecureStore from 'expo-secure-store';

// 공유 코드는 커플 데이터 접근의 유일한 열쇠(capability, ADR-0003)라 암호화 저장소에 보관한다.
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

// 저장·전송은 항상 원문(소문자 hex). 화면 표시만 4자 그룹 하이픈으로 포맷한다.
export function formatShareCode(raw: string): string {
  return (raw.match(/.{1,4}/g) ?? [raw]).join('-');
}

// 사용자가 하이픈·대문자·공백을 섞어 입력해도 원문으로 정규화한다.
export function normalizeShareCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

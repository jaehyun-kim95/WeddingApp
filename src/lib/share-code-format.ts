// 공유 코드 표시/정규화 — 플랫폼 무관 순수 함수. 저장 구현(native/web)이 함께 re-export 한다.

// 저장·전송은 항상 원문(소문자 hex). 화면 표시만 4자 그룹 하이픈으로 포맷한다.
export function formatShareCode(raw: string): string {
  return (raw.match(/.{1,4}/g) ?? [raw]).join('-');
}

// 사용자가 하이픈·대문자·공백을 섞어 입력해도 원문으로 정규화한다.
export function normalizeShareCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

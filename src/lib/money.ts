// 금액 표시·입력 단위 변환. 저장은 원(bigint, DB), 표시·입력은 만원 단위(목업·한국 결혼 비용 관례).
// 사용자 결정 2026-11-10: 입력·표시를 만원 단위로 — 계약금 50만, 잔금 1,450만처럼 다룬다.
// 사용자 결정 2026-11-12(실테스트 중 발견 — 식대 8만5천원처럼 천원 단위 금액 입력 필요): 만원 입력에
// 소수점을 허용해 100원 단위까지 정밀하게 다룬다(1→1만, 1.3→1만3천, 1.32→1만3천2백). 모든 금액 입력
// 필드(비용·하객 공통)는 이 파일의 변환 함수만 거친다 — 정밀도를 또 바꿀 일이 생기면 여기 하나만 고친다.

const MAN = 10000;
const CENT = 100; // 표시·저장 최소 단위(100원 = 만원의 소수 둘째자리). 한국 통화엔 더 작은 단위가 없다.

// 100원 단위로 반올림 — 부동소수 오차(예: 1.32*10000=13199.999…)를 흡수하는 유일한 지점.
function roundToCent(won: number): number {
  return Math.round(won / CENT) * CENT;
}

// 만원 입력값(소수 허용, 예: 8.5) → 원. 저장 직전 변환.
export function manToWon(man: number): number {
  return roundToCent(man * MAN);
}

// 원 → 만원(입력 필드 초기값, 소수 둘째자리까지). 0이면 빈 문자열 쪽에서 처리하도록 숫자만 반환.
export function wonToMan(won: number): number {
  return roundToCent(won) / MAN;
}

// 원 → 표시 문자열("1,500만", "8.5만", 1억 이상은 "1억 2,000만"). 0은 "0".
// 소수부가 0이면 생략, 10의 배수(.10~.90)면 한 자리, 그 외는 두 자리로 보여준다.
export function formatMan(won: number): string {
  const rounded = roundToCent(won);
  if (rounded === 0) return '0';
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const eok = Math.floor(abs / (MAN * MAN));
  const remWon = abs % (MAN * MAN);
  const manWhole = Math.floor(remWon / MAN);
  const centUnits = (remWon % MAN) / CENT; // 0~99 정수(0.01만 단위)
  const decimal = centUnits === 0 ? '' : centUnits % 10 === 0 ? `.${centUnits / 10}` : `.${String(centUnits).padStart(2, '0')}`;
  const manPart = `${manWhole.toLocaleString('ko-KR')}${decimal}`;
  if (eok > 0) {
    return `${sign}${eok}억${remWon === 0 ? '' : ` ${manPart}만`}`;
  }
  return `${sign}${manPart}만`;
}

// 만원 입력 TextInput의 onChangeText에 그대로 연결 — 숫자+소수점 1개만 남긴다(두 번째 '.'부터 제거).
export function sanitizeManInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
}

// 만원 입력 문자열(소수 허용) → 원. 파싱 실패/빈 문자열은 0 — `num()`+`manToWon()` 2단계를 대체한다.
export function parseManInput(text: string): number {
  const n = Number(sanitizeManInput(text));
  return Number.isFinite(n) ? manToWon(n) : 0;
}

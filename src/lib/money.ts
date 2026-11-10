// 금액 표시·입력 단위 변환. 저장은 원(bigint, DB), 표시·입력은 만원 단위(목업·한국 결혼 비용 관례).
// 사용자 결정 2026-11-10: 입력·표시를 만원 단위로 — 계약금 50만, 잔금 1,450만처럼 다룬다.
// 한계(refine-later): 만원 미만 단위는 반올림돼 표현 불가(예: 158.3만). 실테스트 후 필요하면 개선.

const MAN = 10000;

// 원 → 표시 문자열("1,500만", 1억 이상은 "1억 2,000만"). 0은 "0".
export function formatMan(won: number): string {
  const man = Math.round(won / MAN);
  if (man === 0) return '0';
  const sign = man < 0 ? '-' : '';
  const abs = Math.abs(man);
  if (abs >= 10000) {
    const eok = Math.floor(abs / 10000);
    const rem = abs % 10000;
    return `${sign}${eok}억${rem === 0 ? '' : ` ${rem.toLocaleString('ko-KR')}만`}`;
  }
  return `${sign}${abs.toLocaleString('ko-KR')}만`;
}

// 만원 입력값(숫자) → 원. 저장 직전 변환.
export function manToWon(man: number): number {
  return Math.round(man) * MAN;
}

// 원 → 만원(입력 필드 초기값). 0이면 빈 문자열 쪽에서 처리하도록 숫자만 반환.
export function wonToMan(won: number): number {
  return Math.round(won / MAN);
}

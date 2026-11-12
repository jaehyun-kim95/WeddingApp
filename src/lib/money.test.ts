import { formatMan, manToWon, parseManInput, sanitizeManInput, wonToMan } from './money';

describe('formatMan', () => {
  test('만원 단위 콤마 그룹', () => {
    expect(formatMan(50000000)).toBe('5,000만'); // 5000만
    expect(formatMan(23200000)).toBe('2,320만');
    expect(formatMan(1000000)).toBe('100만');
  });
  test('0은 "0"', () => {
    expect(formatMan(0)).toBe('0');
  });
  test('1억 이상은 억+만', () => {
    expect(formatMan(100000000)).toBe('1억'); // 1억 정확
    expect(formatMan(120000000)).toBe('1억 2,000만');
  });
  test('음수(잔여 초과)', () => {
    expect(formatMan(-10000000)).toBe('-1,000만');
  });
  test('소수 둘째자리(100원 단위)까지 보존', () => {
    expect(formatMan(13200)).toBe('1.32만'); // 1만 3천2백원
    expect(formatMan(13000)).toBe('1.3만'); // 10의 배수는 한 자리
    expect(formatMan(10000)).toBe('1만'); // 정확히 떨어지면 소수 없음
  });
  test('경계: 100원 미만은 가장 가까운 100원으로 반올림', () => {
    expect(formatMan(15000)).toBe('1.5만'); // 구 설계(만원 반올림)와 달리 정밀 표시
    expect(formatMan(4999)).toBe('0.5만'); // 4999원 → 5000원(0.5만)으로 반올림, 0이 아님
    expect(formatMan(49)).toBe('0'); // 100원 미만은 0으로 반올림
  });
});

describe('manToWon / wonToMan 왕복', () => {
  test('만원(정수) → 원', () => {
    expect(manToWon(1500)).toBe(15000000);
  });
  test('원 → 만원(정수)', () => {
    expect(wonToMan(15000000)).toBe(1500);
  });
  test('왕복 보존(만원 단위 정수)', () => {
    expect(wonToMan(manToWon(2320))).toBe(2320);
  });
  test('소수 입력(사용자 사양): 1→1만, 1.3→1만3천, 1.32→1만3천2백', () => {
    expect(manToWon(1)).toBe(10000);
    expect(manToWon(1.3)).toBe(13000);
    expect(manToWon(1.32)).toBe(13200);
  });
  test('소수 왕복 보존', () => {
    expect(wonToMan(manToWon(8.5))).toBe(8.5);
    expect(wonToMan(manToWon(1.32))).toBe(1.32);
  });
  test('100원(소수 둘째자리) 미만은 가장 가까운 100원으로 반올림', () => {
    expect(manToWon(1.326)).toBe(13300); // 13260 → 13300
  });
});

describe('sanitizeManInput — 금액 입력 필드 공용 정규화', () => {
  test('숫자만 통과', () => {
    expect(sanitizeManInput('85000')).toBe('85000');
  });
  test('소수점 1개 허용', () => {
    expect(sanitizeManInput('8.5')).toBe('8.5');
  });
  test('두 번째 소수점부터 제거', () => {
    expect(sanitizeManInput('1.3.2')).toBe('1.32');
  });
  test('숫자·소수점 외 문자 제거', () => {
    expect(sanitizeManInput('1,234.5원')).toBe('1234.5');
  });
  test('빈 입력은 빈 문자열', () => {
    expect(sanitizeManInput('')).toBe('');
  });
});

describe('parseManInput — 입력 문자열 → 원(한 번에)', () => {
  test('정수 입력', () => {
    expect(parseManInput('1')).toBe(10000);
  });
  test('소수 입력', () => {
    expect(parseManInput('1.32')).toBe(13200);
  });
  test('빈 입력은 0', () => {
    expect(parseManInput('')).toBe(0);
  });
  test('입력 중인 trailing dot("1.")도 파싱', () => {
    expect(parseManInput('1.')).toBe(10000);
  });
});

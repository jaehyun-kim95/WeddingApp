import { formatMan, manToWon, wonToMan } from './money';

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
  test('경계: 만원 미만은 반올림', () => {
    expect(formatMan(15000)).toBe('2만'); // 1.5만 → 반올림 2만
    expect(formatMan(4999)).toBe('0'); // 0.4999만 → 0
  });
});

describe('manToWon / wonToMan 왕복', () => {
  test('만원 → 원', () => {
    expect(manToWon(1500)).toBe(15000000);
  });
  test('원 → 만원', () => {
    expect(wonToMan(15000000)).toBe(1500);
  });
  test('왕복 보존(만원 단위 정수)', () => {
    expect(wonToMan(manToWon(2320))).toBe(2320);
  });
});

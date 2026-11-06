import { buildMonthGrid, monthLabel, shiftMonth, toDateString } from './calendar-grid';

describe('toDateString', () => {
  test('1~9일·1~9월은 0패딩', () => {
    expect(toDateString(2026, 0, 5)).toBe('2026-01-05');
  });
  test('두 자리 월/일은 그대로', () => {
    expect(toDateString(2026, 10, 30)).toBe('2026-11-30');
  });
});

describe('buildMonthGrid', () => {
  test('2026년 11월 — 1일이 일요일, 30일, 5주(35칸), 트레일링 5칸 빈칸', () => {
    const cells = buildMonthGrid(2026, 10); // month: 0-11, 10=11월
    expect(cells).toHaveLength(35);
    expect(cells[0]).toEqual({ day: 1, dateStr: '2026-11-01', weekday: 0 });
    expect(cells[29]).toEqual({ day: 30, dateStr: '2026-11-30', weekday: 1 });
    expect(cells.slice(30)).toEqual([null, null, null, null, null]);
  });
  test('선행 빈칸이 생기는 달 — 2026년 12월(1일이 화요일)', () => {
    const cells = buildMonthGrid(2026, 11); // 12월
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
    expect(cells[2]).toEqual({ day: 1, dateStr: '2026-12-01', weekday: 2 });
  });
  test('빈 칸을 제외한 날짜 수는 그 달의 일수와 같다(보존성)', () => {
    const cells = buildMonthGrid(2026, 1); // 2026년 2월(평년, 28일)
    expect(cells.filter((c) => c !== null)).toHaveLength(28);
  });
});

describe('shiftMonth', () => {
  test('12월에서 +1 하면 다음 해 1월로 롤오버', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
  test('1월에서 -1 하면 전 해 12월로 롤오버', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
  test('같은 해 안에서는 월만 바뀐다', () => {
    expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
  });
});

describe('monthLabel', () => {
  test('년 월 포맷', () => {
    expect(monthLabel(2026, 10)).toBe('2026년 11월');
  });
});

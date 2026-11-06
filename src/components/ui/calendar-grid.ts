// 달력 그리드 순수 로직 — RN/expo UI 비의존. 코어(CalendarPicker가 소비).
// 월의 1일이 속한 주의 일요일부터 마지막 날이 속한 주의 토요일까지 7열 그리드를 만든다.
// 다른 달 칸은 null(완전히 빈 칸 — DESIGN.md "다른 달 날짜 칸을 흐리게 채우지 않는다" 규범).

export type CalendarCell = { day: number; dateStr: string; weekday: number } | null;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// month: 0~11(Date와 동일).
export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const startWeekday = new Date(year, month, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, dateStr: toDateString(year, month, day), weekday: (startWeekday + day - 1) % 7 });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

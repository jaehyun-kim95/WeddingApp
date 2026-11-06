import type { Area, ChecklistItem } from '@/types/db';
import { groupByArea, overallPercent, selectChecklist, selectStatusChip } from './api';

const area = (id: string, order: number, name: string): Area => ({
  id, created_at: '', code: 'SDM', name_ko: name, sort_order: order,
});
const item = (id: string, areaId: string, done: boolean, sort = 0): ChecklistItem => ({
  id, created_at: '', couple_id: 'c1', area_id: areaId, title: id, assignee: 'BOTH',
  is_done: done, done_at: done ? '2026-01-01T00:00:00Z' : null, due_date: null, memo: null,
  origin: 'USER', sort_order: sort,
});

const areas: Area[] = [area('a2', 2, '웨딩홀'), area('a1', 1, '스드메')];

describe('selectChecklist', () => {
  test('sort_order 오름차순 정렬, 원본 불변', () => {
    const snap: any = { checklist_items: [item('x', 'a1', false, 2), item('y', 'a1', false, 1)] };
    const out = selectChecklist(snap);
    expect(out.map((i) => i.id)).toEqual(['y', 'x']);
    expect(snap.checklist_items.map((i: ChecklistItem) => i.id)).toEqual(['x', 'y']); // 원본 보존
  });
});

describe('groupByArea', () => {
  test('area sort_order 순으로 그룹, done/total/percent 계산', () => {
    const items = [item('i1', 'a1', true), item('i2', 'a1', false), item('i3', 'a2', true)];
    const out = groupByArea(items, areas);
    expect(out.map((s) => s.area.id)).toEqual(['a1', 'a2']); // 정렬
    expect(out[0]).toMatchObject({ doneCount: 1, totalCount: 2, percent: 50 });
    expect(out[1]).toMatchObject({ doneCount: 1, totalCount: 1, percent: 100 });
  });
  test('항목 없는 영역은 0/0·0%', () => {
    const out = groupByArea([], areas);
    expect(out.every((s) => s.totalCount === 0 && s.percent === 0)).toBe(true);
  });
});

describe('overallPercent', () => {
  test('완료 비율 반올림', () => {
    expect(overallPercent([item('a', 'a1', true), item('b', 'a1', false), item('c', 'a1', false)])).toBe(33);
  });
  test('빈 목록은 0', () => {
    expect(overallPercent([])).toBe(0);
  });
});

describe('selectStatusChip', () => {
  const TODAY = '2026-11-10';
  test('완료 항목은 칩 없음(날짜 무관)', () => {
    expect(selectStatusChip({ is_done: true, due_date: '2026-01-01' }, TODAY)).toBeNull();
    expect(selectStatusChip({ is_done: true, due_date: null }, TODAY)).toBeNull();
  });
  test('날짜 없으면 중립 예정(plan)', () => {
    expect(selectStatusChip({ is_done: false, due_date: null }, TODAY)).toEqual({ variant: 'plan', label: '예정' });
  });
  test('과거 날짜는 지남(overdue)', () => {
    expect(selectStatusChip({ is_done: false, due_date: '2026-11-09' }, TODAY)).toEqual({ variant: 'overdue', label: '지남' });
  });
  test('오늘 날짜는 오늘(today)', () => {
    expect(selectStatusChip({ is_done: false, due_date: '2026-11-10' }, TODAY)).toEqual({ variant: 'today', label: '오늘' });
  });
  test('미래 날짜는 예정(upcoming)', () => {
    expect(selectStatusChip({ is_done: false, due_date: '2026-11-11' }, TODAY)).toEqual({ variant: 'upcoming', label: '예정' });
  });
  test('경계값: 하루 전/하루 후', () => {
    const yesterday = '2026-11-09';
    const tomorrow = '2026-11-11';
    expect(selectStatusChip({ is_done: false, due_date: yesterday }, TODAY)?.variant).toBe('overdue');
    expect(selectStatusChip({ is_done: false, due_date: tomorrow }, TODAY)?.variant).toBe('upcoming');
  });
});

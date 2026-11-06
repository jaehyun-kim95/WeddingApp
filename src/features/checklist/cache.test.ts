import type { ChecklistItem, CoupleSnapshot } from '@/types/db';
import { applyCreate, applyDelete, applyToggle, applyUpdate } from './cache';

const item = (id: string, done = false, sort = 0): ChecklistItem => ({
  id, created_at: '', couple_id: 'c1', area_id: 'a1', title: id, assignee: 'BOTH',
  is_done: done, done_at: done ? '2026-01-01T00:00:00Z' : null, due_date: null, memo: null,
  origin: 'USER', sort_order: sort,
});
const snap = (items: ChecklistItem[]): CoupleSnapshot =>
  ({ checklist_items: items } as CoupleSnapshot);

describe('applyToggle', () => {
  test('is_done·done_at 쌍을 맞춘다', () => {
    const out = applyToggle(snap([item('a', false)]), 'a', true);
    expect(out.checklist_items[0].is_done).toBe(true);
    expect(out.checklist_items[0].done_at).not.toBeNull();
  });
  test('멱등성: 두 번 토글하면 상태 원복', () => {
    const s0 = snap([item('a', false)]);
    const s1 = applyToggle(s0, 'a', true);
    const s2 = applyToggle(s1, 'a', false);
    expect(s2.checklist_items[0].is_done).toBe(false);
    expect(s2.checklist_items[0].done_at).toBeNull();
  });
  test('보존성: 대상 외 항목·개수 불변, 원본 불변', () => {
    const s0 = snap([item('a'), item('b')]);
    const out = applyToggle(s0, 'a', true);
    expect(out.checklist_items).toHaveLength(2);
    expect(out.checklist_items[1]).toEqual(item('b'));
    expect(s0.checklist_items[0].is_done).toBe(false); // 원본 보존
  });
  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([item('a')]);
    expect(applyToggle(s0, 'zzz', true).checklist_items).toEqual(s0.checklist_items);
  });
});

describe('applyCreate', () => {
  test('추가 후 sort_order 정렬', () => {
    const out = applyCreate(snap([item('a', false, 1)]), item('b', false, 0));
    expect(out.checklist_items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('applyUpdate', () => {
  test('지정 필드만 변경, 나머지 보존', () => {
    const out = applyUpdate(snap([item('a')]), { id: 'a', title: '새 제목', assignee: 'ME' });
    expect(out.checklist_items[0]).toMatchObject({ title: '새 제목', assignee: 'ME', area_id: 'a1' });
  });
  test('병리: 없는 id는 무변경', () => {
    const s0 = snap([item('a')]);
    expect(applyUpdate(s0, { id: 'zzz', title: 'x', assignee: 'ME' }).checklist_items).toEqual(s0.checklist_items);
  });
});

describe('applyDelete', () => {
  test('해당 id 제거, 나머지 보존', () => {
    const out = applyDelete(snap([item('a'), item('b')]), 'a');
    expect(out.checklist_items.map((i) => i.id)).toEqual(['b']);
  });
  test('병리: 없는 id는 개수 불변', () => {
    expect(applyDelete(snap([item('a')]), 'zzz').checklist_items).toHaveLength(1);
  });
});

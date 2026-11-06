import type { ChecklistItem, CoupleSnapshot } from '@/types/db';
import type { UpdateChecklistItemInput } from './api';

// 스냅샷 캐시 낙관적 패치(순수·불변). CoupleSnapshot을 받아 새 스냅샷을 반환한다.
// 각 함수는 checklist_items 배열만 교체하고 나머지 슬라이스는 그대로 둔다.

function withItems(s: CoupleSnapshot, items: ChecklistItem[]): CoupleSnapshot {
  return { ...s, checklist_items: items };
}

export function applyCreate(s: CoupleSnapshot, item: ChecklistItem): CoupleSnapshot {
  return withItems(s, [...s.checklist_items, item].sort((a, b) => a.sort_order - b.sort_order));
}

export function applyToggle(s: CoupleSnapshot, id: string, isDone: boolean): CoupleSnapshot {
  return withItems(
    s,
    s.checklist_items.map((i) =>
      i.id === id ? { ...i, is_done: isDone, done_at: isDone ? new Date().toISOString() : null } : i,
    ),
  );
}

export function applyUpdate(s: CoupleSnapshot, patch: UpdateChecklistItemInput): CoupleSnapshot {
  return withItems(
    s,
    s.checklist_items.map((i) =>
      i.id === patch.id
        ? { ...i, title: patch.title, assignee: patch.assignee, due_date: patch.dueDate ?? null, memo: patch.memo ?? null }
        : i,
    ),
  );
}

export function applyDelete(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return withItems(s, s.checklist_items.filter((i) => i.id !== id));
}

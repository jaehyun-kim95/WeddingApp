import type { Area, Assignee, ChecklistItem, CoupleSnapshot } from '@/types/db';
import type { ChecklistSection } from './types';
import * as rpc from '@/lib/rpc';

// 코어(순수) — RN/expo UI를 import하지 않는다. 셀렉터 + 쓰기 함수(lib/rpc 위임).

// 읽기: 스냅샷에서 체크리스트 슬라이스. sort_order 안정 정렬(원본 불변).
export function selectChecklist(snapshot: CoupleSnapshot): ChecklistItem[] {
  return [...snapshot.checklist_items].sort((a, b) => a.sort_order - b.sort_order);
}

// 읽기: 영역별로 묶고 진행률을 계산한다(항목 없는 영역도 0/0으로 포함). area sort_order 순.
export function groupByArea(items: ChecklistItem[], areas: Area[]): ChecklistSection[] {
  return [...areas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => {
      const areaItems = items.filter((i) => i.area_id === area.id);
      const doneCount = areaItems.filter((i) => i.is_done).length;
      const totalCount = areaItems.length;
      const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
      return { area, items: areaItems, doneCount, totalCount, percent };
    });
}

// 읽기: 전체 완료 비율(0~100 반올림).
export function overallPercent(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.is_done).length / items.length) * 100);
}

// 읽기: 항목의 상태 칩(순수, today 주입 — 테스트 결정론성 유지).
// 완료면 칩 없음, 날짜가 있으면 지남/오늘/예정 3단계(due_date는 'YYYY-MM-DD' date-only라 사전식
// 문자열 비교로 충분), 날짜가 없으면 중립 '예정'(plan)으로 남긴다.
export type ChecklistStatusChip = { variant: 'overdue' | 'today' | 'upcoming' | 'plan'; label: string };

export function selectStatusChip(
  item: Pick<ChecklistItem, 'is_done' | 'due_date'>,
  today: string,
): ChecklistStatusChip | null {
  if (item.is_done) return null;
  if (!item.due_date) return { variant: 'plan', label: '예정' };
  if (item.due_date < today) return { variant: 'overdue', label: '지남' };
  if (item.due_date === today) return { variant: 'today', label: '오늘' };
  return { variant: 'upcoming', label: '예정' };
}

// 로컬 타임존 기준 오늘 날짜(YYYY-MM-DD). Date.now()에 의존해 비순수 — UI 호출부에서만 쓰고
// selectStatusChip 자체는 순수 유지(테스트는 고정 today 문자열을 직접 주입).
export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 쓰기: lib/rpc 위임(ADR-0003 — supabase.rpc는 lib/rpc에만). shareCode는 호출 훅이 주입.
export type CreateChecklistItemInput = {
  areaId: string;
  title: string;
  assignee: Assignee;
  dueDate?: string | null;
  memo?: string | null;
};
export type UpdateChecklistItemInput = {
  id: string;
  title: string;
  assignee: Assignee;
  dueDate?: string | null;
  memo?: string | null;
};

export function createChecklistItem(shareCode: string, input: CreateChecklistItemInput) {
  return rpc.createChecklistItem(shareCode, input);
}
export function updateChecklistItem(shareCode: string, input: UpdateChecklistItemInput) {
  return rpc.updateChecklistItem(shareCode, input);
}
export function toggleChecklistItem(shareCode: string, id: string, isDone: boolean) {
  return rpc.toggleChecklistItem(shareCode, id, isDone);
}
export function deleteChecklistItem(shareCode: string, id: string) {
  return rpc.deleteChecklistItem(shareCode, id);
}

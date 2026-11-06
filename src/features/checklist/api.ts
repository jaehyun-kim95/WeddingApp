import type { ChecklistItem, CoupleSnapshot } from '@/types/db';

// 코어(순수) — RN/expo UI를 import하지 않는다.

// 읽기: 스냅샷에서 체크리스트 슬라이스. sort_order 기준 안정 정렬(원본 불변).
export function selectChecklist(snapshot: CoupleSnapshot): ChecklistItem[] {
  return [...snapshot.checklist_items].sort((a, b) => a.sort_order - b.sort_order);
}

// 쓰기(추가·완료 토글·수정·삭제)는 Phase 1 migration 0002의 쓰기 RPC 추가 후
// lib/rpc 래퍼를 호출한다. 호출 측 훅이 스냅샷 캐시를 낙관적으로 패치한다.
// TODO(Phase 1): createChecklistItem / toggleChecklistItem / updateChecklistItem / deleteChecklistItem

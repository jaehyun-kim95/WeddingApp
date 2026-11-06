import type { CoupleSnapshot, ScheduleEvent } from '@/types/db';

// 코어(순수) — RN/expo UI를 import하지 않는다.

// 읽기: 스냅샷에서 일정 슬라이스. 날짜 오름차순(미정=event_date null은 뒤로).
export function selectSchedule(snapshot: CoupleSnapshot): ScheduleEvent[] {
  return [...snapshot.schedule_events].sort((a, b) => {
    if (a.event_date === b.event_date) return 0;
    if (a.event_date === null) return 1;
    if (b.event_date === null) return -1;
    return a.event_date < b.event_date ? -1 : 1;
  });
}

// 일정은 payment.due_date·vendor.contract_date도 함께 표시할 수 있다(교차 참조, ADR-0001 경계는 유지).
// 쓰기(추가·수정·삭제)는 Phase 1 migration 0002의 쓰기 RPC 추가 후 lib/rpc 래퍼 호출.
// TODO(Phase 1): createScheduleEvent / updateScheduleEvent / deleteScheduleEvent

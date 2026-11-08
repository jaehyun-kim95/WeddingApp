import type { CoupleSnapshot, ScheduleEvent } from '@/types/db';
import type { UpdateScheduleEventInput } from './api';

// 스냅샷 캐시 낙관적 패치(순수·불변). CoupleSnapshot을 받아 새 스냅샷을 반환한다.
// checklist/cache.ts와 동일 모양 — 일정엔 완료 개념이 없어 toggle류는 없다.

function withEvents(s: CoupleSnapshot, events: ScheduleEvent[]): CoupleSnapshot {
  return { ...s, schedule_events: events };
}

export function applyCreate(s: CoupleSnapshot, event: ScheduleEvent): CoupleSnapshot {
  return withEvents(s, [...s.schedule_events, event]);
}

export function applyUpdate(s: CoupleSnapshot, patch: UpdateScheduleEventInput): CoupleSnapshot {
  return withEvents(
    s,
    s.schedule_events.map((e) =>
      e.id === patch.id
        ? {
            ...e,
            title: patch.title,
            event_date: patch.eventDate ?? null,
            event_time: patch.eventTime ?? null,
            location: patch.location ?? null,
            assignee: patch.assignee ?? null,
            category: patch.category,
          }
        : e,
    ),
  );
}

export function applyDelete(s: CoupleSnapshot, id: string): CoupleSnapshot {
  return withEvents(s, s.schedule_events.filter((e) => e.id !== id));
}

import type { TimelineItem } from '@/features/schedule/types';
import type { ChecklistItem } from '@/types/db';

// 홈 "다가오는 일정·할 일" 통합 피드 아이템(판별 유니온). 원본 행을 품어, 렌더 시 기존
// 도메인 컴포넌트(CheckRow/EventRow)에 그대로 넘긴다 — 홈은 집계 뷰라 새 행 UI를 만들지 않는다.
// date는 정렬 키(체크리스트=due_date, 일정=event_date). null = 날짜 미정(맨 뒤).
export type HomeFeedItem =
  | { kind: 'CHECKLIST'; date: string | null; item: ChecklistItem }
  | { kind: 'EVENT'; date: string | null; item: TimelineItem };

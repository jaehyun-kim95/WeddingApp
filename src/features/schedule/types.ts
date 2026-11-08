import type { EventCategory } from '@/types/db';

// 뷰/파생 타입. 일정 화면은 캘린더(날짜별)와 리스트(아젠다) 두 뷰를 전환한다.
// TimelineItem은 지금은 schedule_event만 매핑하지만, 비용 화면 완료 후 payment.due_date·
// vendor.contract_date를 같은 모양으로 합류시킬 수 있게 kind로 출처를 구분해 둔다
// (사용자 결정 2026-11-08 — 교차 참조는 비용 화면 완료 후 별도 작업).
export type TimelineItem = {
  id: string;
  date: string | null; // YYYY-MM-DD, null = 날짜 미정
  title: string;
  sub: string | null; // "시간 · 장소" 조합(있는 것만)
  kind: 'EVENT';
  category: EventCategory;
  areaId: string | null;
};

export type AgendaGroup = {
  date: string | null; // null = "날짜 미정" 그룹(항상 맨 뒤)
  items: TimelineItem[];
};

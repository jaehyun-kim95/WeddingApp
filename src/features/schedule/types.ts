import type { Area, EventCategory } from '@/types/db';

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

// 영역별 그룹(리스트 뷰 "영역별" 세그먼트용). 체크리스트 ChecklistSection과 달리 완료 개념이
// 없어 진행률 필드는 없다. 일정 있는 영역만 포함하고, area: null은 "영역 없음" 그룹(항상 맨 뒤,
// 해당 일정이 있을 때만 존재).
export type AreaAgendaGroup = {
  area: Area | null;
  items: TimelineItem[];
};

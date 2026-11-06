import type { ScheduleEvent } from '@/types/db';

// 뷰/파생 타입. 일정 화면은 캘린더(날짜별)와 리스트 두 뷰를 전환한다.
export type ScheduleDay = {
  date: string; // YYYY-MM-DD
  events: ScheduleEvent[];
};

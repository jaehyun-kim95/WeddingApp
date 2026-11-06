import type { Area, ChecklistItem } from '@/types/db';

// 뷰/파생 타입. 체크리스트 화면은 영역별 섹션으로 묶어 보여준다(미니 미터 요약 포함).
export type ChecklistSection = {
  area: Area;
  items: ChecklistItem[];
  doneCount: number;
  totalCount: number;
  percent: number; // 0~100 정수
};

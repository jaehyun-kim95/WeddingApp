import type { AreaCode, ChecklistItem } from '@/types/db';

// 뷰/파생 타입(db.ts 행 타입을 넘어서는 것만). 체크리스트 화면은 영역별 섹션으로 묶어 보여준다.
export type ChecklistSection = {
  areaCode: AreaCode;
  items: ChecklistItem[];
  doneCount: number;
  totalCount: number;
};

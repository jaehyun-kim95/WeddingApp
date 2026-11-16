import type { Area, Photo, ScheduleEvent } from '@/types/db';
import type { ChecklistSection } from '@/features/checklist/types';
import type { AreaVendorGroup } from '@/features/vendors/types';
import type { AreaBreakdown } from '@/features/budget/types';
import type { GuestSummary } from '@/features/guests/types';

// 뷰/파생 타입. 모아보기는 기존 도메인 셀렉터의 영역별 결과를 area.id 기준으로 합친 것뿐이라
// 새 집계 로직은 일정 하나뿐이고(다가오는 일정만 제한 개수), 나머지는 기존 타입을 그대로 재사용한다.
export type AreaOverview = {
  area: Area;
  checklist: ChecklistSection;
  schedule: ScheduleEvent[]; // 날짜 있고 오늘 이후인 것만, 날짜 오름차순, 상위 N개
  vendor: AreaVendorGroup;
  cost: AreaBreakdown | null; // GUEST 영역은 비용 미니섹션이 없다(하객은 별도 수입 — 지출과 상계 안 함)
  guestSummary: GuestSummary | null; // GUEST 영역에서만 채워진다
  photos: Photo[];
};

import type { Area, CoupleSnapshot } from '@/types/db';
import { groupByArea, selectChecklist } from '@/features/checklist/api';
import { selectVendorsByArea } from '@/features/vendors/api';
import { selectAreaBreakdown } from '@/features/budget/api';
import { selectPhotosByArea } from '@/features/gallery/api';
import { selectGuestSummary } from '@/features/guests/api';
import type { AreaOverview } from './types';

// 코어(순수) — RN/expo UI를 import하지 않는다. 모아보기는 새 데이터가 없는 집계 화면이라, 각
// 도메인의 기존 영역별 셀렉터를 area.id 기준으로 묶기만 한다(home/api.ts와 동일하게 api 파일을
// 직접 import — 배럴은 RN hooks를 끌고 와 순환 위험이 있다).

const UPCOMING_LIMIT = 3;

export function selectAreaOverviews(
  snapshot: CoupleSnapshot, areas: Area[], today: string,
): AreaOverview[] {
  const checklistSections = groupByArea(selectChecklist(snapshot), areas);
  const vendorGroups = selectVendorsByArea(snapshot, areas);
  const costBreakdowns = selectAreaBreakdown(snapshot, areas);
  const photoGroups = selectPhotosByArea(snapshot, areas);
  const guestSummary = selectGuestSummary(snapshot);

  const checklistByArea = new Map(checklistSections.map((s) => [s.area.id, s]));
  const vendorByArea = new Map(vendorGroups.map((g) => [g.area.id, g]));
  const costByArea = new Map(costBreakdowns.map((b) => [b.area.id, b]));
  const photosByArea = new Map(photoGroups.map((g) => [g.area.id, g.photos]));

  return [...areas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => {
      const isGuest = area.code === 'GUEST';
      return {
        area,
        checklist: checklistByArea.get(area.id)!,
        schedule: selectUpcomingEvents(snapshot, area.id, today),
        vendor: vendorByArea.get(area.id)!,
        cost: isGuest ? null : (costByArea.get(area.id) ?? null),
        guestSummary: isGuest ? guestSummary : null,
        photos: photosByArea.get(area.id) ?? [],
      };
    });
}

// 읽기: 영역에 속하고 날짜가 today 이후(오늘 포함)인 일정만, 날짜 오름차순 상위 limit개.
function selectUpcomingEvents(
  snapshot: CoupleSnapshot, areaId: string, today: string, limit = UPCOMING_LIMIT,
) {
  return snapshot.schedule_events
    .filter((e) => e.area_id === areaId && e.event_date !== null && e.event_date >= today)
    .sort((a, b) => (a.event_date! < b.event_date! ? -1 : a.event_date! > b.event_date! ? 1 : 0))
    .slice(0, limit);
}

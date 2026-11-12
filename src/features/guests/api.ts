import type {
  AttendStatus, CoupleSnapshot, Guest, GuestRelation, GuestSide,
} from '@/types/db';
import type { GuestSection, GuestSummary, SideSummary } from './types';
import * as rpc from '@/lib/rpc';

// 코어(순수) — RN/expo UI를 import하지 않는다. 셀렉터 + 쓰기 함수(lib/rpc 위임).

// 라벨 맵(UI·엑셀 공용). code-definitions.md와 1:1.
export const SIDE_LABEL: Record<GuestSide, string> = { GROOM: '신랑 측', BRIDE: '신부 측' };
export const RELATION_LABEL: Record<GuestRelation, string> = {
  FAMILY: '가족', FRIEND: '친구', WORK: '직장', ACQUAINTANCE: '지인',
};
export const ATTEND_LABEL: Record<AttendStatus, string> = {
  ATTENDING: '참석', MAYBE: '미정', ABSENT: '불참',
};
// 그룹·필터 표시 순서(enum 고정 순).
export const SIDE_ORDER: GuestSide[] = ['GROOM', 'BRIDE'];
export const RELATION_ORDER: GuestRelation[] = ['FAMILY', 'FRIEND', 'WORK', 'ACQUAINTANCE'];

// 읽기: 스냅샷에서 하객 슬라이스(생성 순 안정 — created_at 그대로, 원본 불변).
export function selectGuests(snapshot: CoupleSnapshot): Guest[] {
  return [...snapshot.guests];
}

// 읽기: 임의의 하객 목록(전체·측별 모두 가능)에 대한 요약 집계 — 화면이 측 필터에 맞춰
// 재사용한다(전체/신랑측/신부측 대시보드, 사용자 요청 2026-11-12). 예상 식사 인원은 '참석 확정'만
// 센다(목업 기준). 혼주는 축의금 집계에서 gift_amount=null이면 자연히 제외된다(불변식: 혼주는 보통 null).
export function summarizeGuests(guests: Guest[], mealPrice: number): GuestSummary {
  let attending = 0, maybe = 0, absent = 0, mealCount = 0, giftTotal = 0, giftCount = 0;
  for (const g of guests) {
    if (g.attend_status === 'ATTENDING') { attending += 1; mealCount += g.meal_count; }
    else if (g.attend_status === 'MAYBE') maybe += 1;
    else absent += 1;
    if (g.gift_amount != null) { giftTotal += g.gift_amount; giftCount += 1; }
  }
  return {
    total: guests.length, attending, maybe, absent,
    mealCount, mealPrice, mealTotal: mealCount * mealPrice, giftTotal, giftCount,
  };
}

// 읽기: 스냅샷 전체 하객 기준 요약(기본값 — 측 필터 없이 "전체"를 볼 때).
export function selectGuestSummary(snapshot: CoupleSnapshot): GuestSummary {
  return summarizeGuests(snapshot.guests, snapshot.couple.meal_price ?? 0);
}

// 읽기: 측 소계(섹션 헤더). 해당 측 인원 수 + 축의금 합.
export function selectSideSummary(guests: Guest[], side: GuestSide): SideSummary {
  const sideGuests = guests.filter((g) => g.side === side);
  const giftTotal = sideGuests.reduce((sum, g) => sum + (g.gift_amount ?? 0), 0);
  return { side, count: sideGuests.length, giftTotal };
}

// 읽기: 관계별 그룹(그룹 보기 ON). RELATION_ORDER 순. 빈 관계는 제외(목업은 건수 있는 소제목만 노출).
export function groupByRelation(guests: Guest[]): GuestSection<Guest>[] {
  return RELATION_ORDER
    .map((relation) => {
      const g = guests.filter((x) => x.relation === relation);
      return { relation, label: RELATION_LABEL[relation], guests: g, count: g.length };
    })
    .filter((section) => section.count > 0);
}

// 읽기: 홈 대시보드용 축의금 총액(접수분 합). features/home이 재사용.
export function selectGiftTotal(snapshot: CoupleSnapshot): number {
  return snapshot.guests.reduce((sum, g) => sum + (g.gift_amount ?? 0), 0);
}

// 쓰기: lib/rpc 위임(ADR-0003 — supabase.rpc는 lib/rpc에만). shareCode는 호출 훅이 주입.
export type CreateGuestInput = {
  name: string;
  side: GuestSide;
  relation: GuestRelation;
  attendStatus: AttendStatus;
  isHost: boolean;
  mealCount: number;
  giftAmount?: number | null;
  memo?: string | null;
};
export type UpdateGuestInput = CreateGuestInput & { id: string };
// 엑셀 1행의 정규화 결과(= import_guests RPC의 한 요소). CreateGuestInput과 동일 모양.
export type ImportGuestRow = CreateGuestInput;

export function createGuest(shareCode: string, input: CreateGuestInput) {
  return rpc.createGuest(shareCode, input);
}
export function updateGuest(shareCode: string, input: UpdateGuestInput) {
  return rpc.updateGuest(shareCode, input);
}
export function setAttendStatus(shareCode: string, id: string, status: AttendStatus) {
  return rpc.setAttendStatus(shareCode, id, status);
}
export function deleteGuest(shareCode: string, id: string) {
  return rpc.deleteGuest(shareCode, id);
}
export function updateMealPrice(shareCode: string, amount: number) {
  return rpc.updateMealPrice(shareCode, amount);
}
export function importGuests(shareCode: string, rows: ImportGuestRow[]) {
  return rpc.importGuests(shareCode, rows);
}

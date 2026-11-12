import type { GuestRelation, GuestSide } from '@/types/db';

// types/db.ts(행 타입)를 넘어서는 뷰·파생 타입만 둔다.

// 하객 상단 요약(집계) — selectGuestSummary 반환.
export type GuestSummary = {
  total: number; // 전체 하객 수
  attending: number; // 참석 확정 수
  maybe: number; // 미정 수
  absent: number; // 불참 수
  mealCount: number; // 예상 식사 인원 = Σ meal_count where ATTENDING
  mealPrice: number; // 1인 식대 단가(couple.meal_price)
  mealTotal: number; // 식대 총액 = mealCount × mealPrice
  giftTotal: number; // 축의금 총액(접수분 합)
  giftCount: number; // 축의금 접수 건수(gift_amount not null)
};

// 측(신랑/신부) 소계 — 섹션 헤더용.
export type SideSummary = {
  side: GuestSide;
  count: number;
  giftTotal: number;
};

// 관계별 그룹(그룹 보기 ON) — groupByRelation 반환. guest 행은 api에서 참조.
export type GuestSection<T> = {
  relation: GuestRelation;
  label: string;
  guests: T[];
  count: number;
};

// 엑셀 가져오기 결과 — 유효 행 + 사유가 붙은 오류 행.
export type RowError = {
  row: number; // 1-base 원본 행 번호(헤더 제외)
  reason: string;
};

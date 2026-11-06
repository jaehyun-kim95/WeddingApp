import type { Couple, CoupleSnapshot } from '@/types/db';

// 코어(순수 로직) — RN/expo UI를 import하지 않는다. 스냅샷 셀렉터 + 쓰기 래퍼만 둔다.

// 읽기: 스냅샷에서 커플 기본 정보를 꺼낸다.
export function selectCouple(snapshot: CoupleSnapshot): Couple {
  return snapshot.couple;
}

// 쓰기(결혼 정보 수정·표시 토글)는 Phase 1 migration 0002에서 update_couple RPC를 추가한 뒤
// lib/rpc에 래퍼를 두고 여기서 호출한다(ADR-0003: 테이블 직접 접근 금지, RPC만).
// TODO(Phase 1): export async function updateCouple(input: UpdateCoupleInput): Promise<void>

import type { Couple, CoupleSnapshot, WeddingDateStatus } from '@/types/db';
import * as rpc from '@/lib/rpc';

// 코어(순수 로직) — RN/expo UI를 import하지 않는다. 스냅샷 셀렉터 + 쓰기 래퍼만 둔다.

// 읽기: 스냅샷에서 커플 기본 정보를 꺼낸다.
export function selectCouple(snapshot: CoupleSnapshot): Couple {
  return snapshot.couple;
}

// 쓰기: lib/rpc 위임(ADR-0003 — supabase.rpc는 lib/rpc에만). shareCode는 호출 훅이 주입.
export type UpdateCoupleInput = {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  weddingDateStatus: WeddingDateStatus;
  weddingTime: string | null;
  venue: string | null;
  notifyPayments: boolean;
};

export function updateCouple(shareCode: string, input: UpdateCoupleInput) {
  return rpc.updateCouple(shareCode, input);
}

// 재발급=교체(ADR-0008) — 성공 후 호출부(useRegenerateShareCode)가 ShareCodeProvider.save(newCode)로
// 전환한다. 여기선 RPC 호출만 위임.
export function regenerateShareCode(shareCode: string) {
  return rpc.regenerateShareCode(shareCode);
}

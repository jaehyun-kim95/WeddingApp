import { supabase } from './supabase';
import type { CoupleSnapshot, WeddingDateStatus } from '@/types/db';

// 커플 데이터 접근의 유일한 통로(ADR-0003). 테이블 직접 접근 없이 RPC만 호출한다.
// 쓰기 RPC(create_*/update_*/delete_*)는 화면을 만드는 Phase에서 테이블별로 추가한다.

// 공유 코드가 무효/미존재일 때(서버가 SQLSTATE 'PT401'로 던짐) → 온보딩으로 분기하라는 신호.
export class ShareCodeInvalidError extends Error {
  constructor() {
    super('유효하지 않은 공유 코드입니다.');
    this.name = 'ShareCodeInvalidError';
  }
}

export type CreateCoupleInput = {
  groomName: string;
  brideName: string;
  weddingDate?: string | null;
  weddingDateStatus: WeddingDateStatus;
  venue?: string | null;
};

// 새 커플 생성 → 서버가 공유 코드를 발급해 반환(원문 hex).
export async function createCouple(input: CreateCoupleInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_couple', {
    p_groom_name: input.groomName,
    p_bride_name: input.brideName,
    p_wedding_date: input.weddingDate ?? null,
    p_wedding_date_status: input.weddingDateStatus,
    p_venue: input.venue ?? null,
  });
  if (error) throw error;
  return data as string;
}

// 공유 코드로 커플 전체 스냅샷 조회. 코드가 무효면 ShareCodeInvalidError.
export async function getCoupleSnapshot(shareCode: string): Promise<CoupleSnapshot> {
  const { data, error } = await supabase.rpc('get_couple_snapshot', { p_share_code: shareCode });
  if (error) {
    if ((error as { code?: string }).code === 'PT401') throw new ShareCodeInvalidError();
    throw error;
  }
  if (!data) throw new ShareCodeInvalidError();
  return data as CoupleSnapshot;
}

import { supabase } from './supabase';
import type { Area, AuspiciousDay } from '@/types/db';

// 전역 참조(ADR-0003: area·seed_*·auspicious_day만 직접 select 허용 — 공개 읽기 정책).
// 커플 데이터가 아니므로 RPC 게이트웨이를 거치지 않는다.
export async function getAreas(): Promise<Area[]> {
  const { data, error } = await supabase.from('area').select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []) as Area[];
}

export async function getAuspiciousDays(): Promise<AuspiciousDay[]> {
  const { data, error } = await supabase.from('auspicious_day').select('*').order('day');
  if (error) throw error;
  return (data ?? []) as AuspiciousDay[];
}

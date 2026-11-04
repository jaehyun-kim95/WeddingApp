import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

// 상대 기기의 변경을 받는 구독(ADR-0003). 트리거가 토픽 couple:<share_code>(public)로 보낸 '변경
// 신호'를 받으면 해당 커플 스냅샷 쿼리를 무효화해 재조회한다(흐름도 03). 행 데이터는 신호에 없다.
export function useCoupleRealtime(shareCode: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!shareCode) return;

    const channel = supabase
      .channel(`couple:${shareCode}`) // 기본 public 채널 — 트리거의 private=false와 매칭
      .on('broadcast', { event: 'change' }, () => {
        qc.invalidateQueries({ queryKey: ['snapshot', shareCode] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shareCode, qc]);
}

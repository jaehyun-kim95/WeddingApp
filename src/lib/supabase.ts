import 'react-native-url-polyfill/auto'; // RN에서 supabase-js(URL/WebSocket)가 필요로 함

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    'Supabase 환경변수가 없습니다. .env의 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY를 확인하세요.',
  );
}

// Auth를 쓰지 않는다(ADR-0002) — 세션 저장·토큰 갱신·URL 세션 감지를 모두 끈다.
// 커플 데이터 접근은 전부 RPC(@/lib/rpc)로만 하고, 테이블을 직접 from()하지 않는다(ADR-0003).
export const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// jest는 `expo start`와 달리 .env를 자동으로 읽지 않는다(@expo/cli가 로드 책임을 짐).
// src/lib/supabase.ts가 모듈 로드 시점에 EXPO_PUBLIC_SUPABASE_* 를 검사해 없으면 throw하므로,
// @/lib/rpc를 import하는 테스트(예: checklist api.test.ts)가 전부 깨진다.
// `expo start`가 쓰는 것과 동일한 @expo/env 로더로 .env를 미리 읽어 process.env에 채운다.
const { load } = require('@expo/env');

load(__dirname, { silent: true });

// 순수 로직 테스트는 Supabase에 접속하지 않지만, src/lib/supabase.ts가 import 시점에
// EXPO_PUBLIC_SUPABASE_* 존재를 검사해 throw한다. .env가 없는 환경(CI 등)에서도 테스트가
// 돌도록 더미 폴백을 둔다(실제 .env 값이 있으면 그대로 우선).
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost';
process.env.EXPO_PUBLIC_SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'test-anon-key';

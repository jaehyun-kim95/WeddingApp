// jest는 `expo start`와 달리 .env를 자동으로 읽지 않는다(@expo/cli가 로드 책임을 짐).
// src/lib/supabase.ts가 모듈 로드 시점에 EXPO_PUBLIC_SUPABASE_* 를 검사해 없으면 throw하므로,
// @/lib/rpc를 import하는 테스트(예: checklist api.test.ts)가 전부 깨진다.
// `expo start`가 쓰는 것과 동일한 @expo/env 로더로 .env를 미리 읽어 process.env에 채운다.
const { load } = require('@expo/env');

load(__dirname, { silent: true });

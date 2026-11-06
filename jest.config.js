// 순수 로직 단위 테스트용. jest-expo preset이 babel-preset-expo로 TS/JSX를 변환한다.
// 타입 검사는 tsc가 따로 한다(여기선 런타임 동작만).
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // .env의 EXPO_PUBLIC_* 로딩(expo start와 동일한 @expo/env) — src/lib/supabase.ts가
  // 모듈 로드 시 이 값을 검사해 없으면 throw한다(@/lib/rpc를 import하는 테스트 전부 영향).
  setupFiles: ['<rootDir>/jest.setup.env.js'],
};

// 순수 로직 단위 테스트용. jest-expo preset이 babel-preset-expo로 TS/JSX를 변환한다.
// 타입 검사는 tsc가 따로 한다(여기선 런타임 동작만).
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};

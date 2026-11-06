// 쿼리 키 단일 출처. 스냅샷 읽기 훅과 Realtime 무효화가 "같은 키"를 쓰도록 한 곳에 모은다.
// 키 문자열을 바꾸면 이 파일만 고치면 된다(예전엔 use-couple-realtime이 키를 하드코딩해 드리프트 위험).
export const coupleKeys = {
  // 공유 코드별 전체 스냅샷(ADR-0003: 읽기는 단일 스냅샷). 모든 도메인 읽기가 이 캐시 위에 얹힌다.
  snapshot: (shareCode: string) => ['snapshot', shareCode] as const,
};

// couple 도메인 공개 API(배럴). 화면·다른 도메인은 이 경로로 import한다.
// 주의: providers/share-code-provider는 순환을 피하려고 이 배럴이 아니라 './use-realtime'를 직접 쓴다.
export { coupleKeys } from './keys';
export { useCoupleRealtime } from './use-realtime';
export { useCoupleSnapshot, useCouple } from './hooks';
export { selectCouple } from './api';

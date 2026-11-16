# Phase 3 작업 보고 — 모아보기(areas) + 설정(settings) 핵심

Phase 3(재조합·운영)의 4개 작업(모아보기·설정·표준 시드/백업·알림) 중 **모아보기 + 설정 핵심**만
이번에 진행했다. 표준 시드 불러오기·백업 내보내기/가져오기·`expo-notifications` 납부일 알림·길일
데이터는 다음 세션으로 넘긴다(사용자 결정 2026-11-16).

## 개발 내용

**준비영역 모아보기 (`app/areas.tsx` + `features/areas/`)** — 읽기 전용 집계 화면. 새 RPC 없이
기존 도메인 셀렉터(체크리스트 `groupByArea`, 업체 `selectVendorsByArea`, 비용 `selectAreaBreakdown`,
갤러리 `selectPhotosByArea`, 하객 `selectGuestSummary`)를 `area.id` 기준으로 묶는 `selectAreaOverviews`
하나만 새로 작성(`home/api.ts`와 동일하게 api 파일을 직접 import, 배럴 금지). 일정만 새 로직
(`selectUpcomingEvents` — 오늘 이후 날짜 있는 것만, 상위 3개)이 필요했다. 목업의 순수 CSS 체크박스
아코디언 트릭은 `useState<Set<string>>`으로 재구현해 **여러 영역을 동시에 펼칠 수 있게** 했다(상호
배타 아님, 목업과 동일 동작). 미니 섹션은 기존 컴포넌트(`CheckRow`, `EventRow`+`toTimelineItem`,
`ListRow`+`Chip`+`formatMan`)를 최대한 재사용했다.

**설정 (`app/settings.tsx`)** — `design/settings.html` 4그룹 중 **결혼 정보 + 애인과 공유 + 표시
(납부일 알림만)** 3그룹만 구현. "데이터"(표준 시드/백업) 그룹과 "길일 표시" 토글은 범위 밖(사용자
결정)이라 화면에서 아예 제외했다. 결혼 정보는 "두 사람"/"예식 날짜"/"예식 장소" 3개 행 모두 하나의
`WeddingInfoForm` 모달(이름·날짜미정모드·날짜·시간·장소)을 연다 — RPC 1번 호출이라 모달을 쪼갤
이유가 없었다. 공유 코드 카드(`ShareCodeCard`)는 복사(`expo-clipboard`, 신규 설치)·링크 공유(RN
core `Share`)·재발급(확인 다이얼로그 필수, ADR-0008)을 제공한다.

**새 RPC** (`supabase/migrations/0009_couple_writes.sql`, 사용자가 SQL Editor에서 직접 실행):
`update_couple`(결혼 정보 전체 필드+`notify_payments`), `regenerate_share_code`(기존
`gen_share_code()` 재사용, 재발급=즉시 교체). `trg_bc_couple`가 이미 모든 UPDATE를 브로드캐스트해
신규 트리거는 불필요했다. 클라이언트 쪽은 기존 패턴 그대로: `lib/rpc.ts` 래퍼 → `features/couple/api.ts`
위임 → `cache.ts`(`applyUpdateCouple`, 순수·낙관적 패치) → `hooks.ts`(`useUpdateCouple`는 guests류와
동일한 onMutate/onError/onSettled 배선, `useRegenerateShareCode`는 스냅샷이 아니라 공유 코드 자체가
바뀌므로 별도로 `ShareCodeProvider.save(newCode)` 호출).

**ADR-0008**(공유 코드 재발급=교체, 이원 토큰/알림 전송 안 씀) 신규 작성 — 재발급이 "되돌리기 비싼
선택"(상대방 세션이 즉시 끊기고 되돌릴 방법이 없음)이라 CLAUDE.md ADR 트리거에 해당.

## 이슈

없음 — 두 화면 모두 구현 중 설계를 바꿔야 했던 막힌 지점은 없었다.

## 트러블슈팅

- **길일(auspicious_day)·시드(seed_checklist_item/seed_roadmap_step) 테이블이 스키마만 있고
  데이터 행이 비어 있음을 계획 단계에서 발견** — 길일 표시 메커니즘(`useAuspiciousDays`, 캘린더
  표식)은 Phase 0/1에서 이미 완성돼 있어 데이터만 채우면 동작하지만, 전통 역법 기반 정확한 날짜는
  임의로 만들 수 없는 전문 영역이라 사용자에게 먼저 확인했고 "길일 기능은 이번에 사용하지 않음"으로
  결정돼 설정 화면에서 토글 자체를 뺐다.
- **웹 프리뷰 검증 중 CDP 스크린샷이 간헐적으로 타임아웃** — 렌더링 자체는 정상이었고(실제로 재시도
  시 성공한 스크린샷으로 확인), `read_page`(접근성 트리) 결과도 중첩 `Text` 컴포넌트의 자식 텍스트를
  병합·누락해 보여주는 경우가 있었다(예: "하객 0명"이 "하객 명"으로 보임). 접근성 트리만으로 판단하지
  않고 `document.body.innerText`/`getComputedStyle` 직접 조회로 교차 확인해 실제로는 버그가 아님을
  확인했다 — 이후 웹 프리뷰 검증 시 접근성 트리 단독 신뢰는 피하고 DOM 텍스트/스타일 직접 조회를
  병행하는 편이 안전하다.
- **실기기 테스트에서 공유 코드 카드의 "복사" 버튼이 화면 밖으로 밀려남**(사용자 리포트, 스크린샷
  첨부) — 원인은 실제 공유 코드가 24자 소문자 hex(`gen_share_code()`)인데, `design/settings.html`
  목업이 가정한 짧은 포맷(`WED-7K2M-9QX`)용 큰 폰트(22px, `stat`)로 "복사" 버튼과 한 줄에
  `justify-content: space-between`으로 배치해 긴 문자열이 버튼을 밀어냈다. 웹 프리뷰는 데스크톱
  너비로 띄워 이 레이아웃 붕괴가 재현되지 않았다(모바일 폭에서만 드러남) — 실기기 테스트로만
  잡힌 버그. "공유 코드" 라벨+복사 버튼을 한 줄, 코드 문자열은 그 아래 독립된 전체 너비 줄로
  분리해 고쳤다(`02` 「구현 함정 — 커플 설정·모아보기 feature」에 재발 방지 메모 추가) — 실기기
  재확인으로 해결 완료.

## 사이드 이펙트 및 조치

- `features/couple/api.ts`의 `// TODO(Phase 1): updateCouple` 자리를 실제 구현으로 채움(기존
  주석이 Phase 1을 가리켰지만 실제로는 Phase 3에서 구현) — 코드 변경 외 사이드 이펙트 없음.
- `features/couple/hooks.ts`가 `selectCouple` 단일 named import에서 `import * as api`로 바뀌어
  `useCouple()` 내부 호출이 `api.selectCouple`로 변경됨 — 외부 공개 API(barrel export)는 동일하게
  유지돼 다른 feature에 영향 없음(tsc/jest로 확인).
- `expo-clipboard` 패키지 신규 설치(`npx expo install`) — 기존 SDK 58 호환 버전으로 설치됨,
  다른 의존성과 충돌 없음(`npx expo-doctor` 재실행은 하지 않았으나 `npx expo install`이 호환
  버전을 자동 선택).

## 검증 결과

- [x] `npx tsc --noEmit` 0에러
- [x] `npx jest`(246개, 신규 9개 — areas 7개+couple cache 2개) 0에러
- [x] `npx eslint` 0에러(신규 파일 전부)
- [x] 모아보기 집계 수치가 각 원본 화면과 일치 — 단위테스트로 체크리스트/업체/비용/갤러리/하객
      셀렉터와 직접 대조(동일 스냅샷 교차 검증) + 웹 프리뷰에서 실제 테스트 계정 데이터로 재확인
      (체크리스트 화면 "아직 할 일이 없습니다" ↔ 모아보기 "할 일이 모두 끝났어요" 일치, 일정 화면의
      과거 날짜 이벤트 3건이 모아보기 "다가오는 일정"에서 올바르게 제외됨을 교차 확인)
- [x] 웹 프리뷰 실측: 모아보기 아코디언 다중 동시 펼침(스드메·웨딩홀·하객 동시 ▲ 확인), GUEST
      영역만 비용 대신 "하객 · 명단" 미니섹션 노출
- [x] 웹 프리뷰 실측: 설정 화면 렌더링, 결혼정보 편집 모달 열기(필드 사전 채움 확인)/닫기
- [x] `update_couple` RPC 실측(SQL Editor 적용 후) — 납부일 알림 토글 저장→새로고침 후 유지 확인,
      예식 장소 저장→새로고침 후 유지 확인, 둘 다 원래 값으로 복원해 테스트 데이터 원상복구
- [x] **사용자 실기기 확인 완료** — 공유 코드 카드 레이아웃 버그 리포트→수정→실기기 재확인까지
      끝남(위 트러블슈팅 참고)
- [ ] **공유 코드 재발급(`regenerate_share_code`) 버튼 플로우 미검증** — 확인 다이얼로그(`Alert.alert`)가
      웹 프리뷰 자동화 환경에서 브라우저 네이티브 dialog를 띄워 세션을 멈출 위험이 있어 자동화로
      실행하지 않았다. RPC 자체(마이그레이션 SQL)는 적용됐지만 실제 클릭→확인→전환 플로우는
      실기기 또는 수동 웹 테스트로 확인 필요.
- [ ] **표준 시드 불러오기·백업·길일·납부일 알림(expo-notifications)** — 전부 범위 밖(다음 세션)

# Phase 2 — 정보/장부(업체·하객·갤러리) 개발 완료 보고

## 개발 내용

Phase 1(홈·일정·체크리스트·비용) 위에 세 독립 슬라이스를 추가했다. 셋 다
`features/<도메인>/{api.ts,cache.ts,hooks.ts,components/}` 구조(`02-architecture.md` 템플릿)를
따른다.

- **업체**(`app/vendors.tsx`+`features/vendors/`): 정보 관리 전용(ADR-0001 — 금액 소스 아님). 영역
  필터+계약 패널(영역당 여러 개)+후보 리스트+폼 모달. 후보→계약 전환은 모달의 명시적 버튼(전용
  토글 없음). "비용에서 보기"로 연결 지출 상세를 비용 탭에서 자동 오픈. 쓰기 RPC는
  `0007_vendor_writes.sql`.
- **하객**(`app/guests.tsx`+`features/guests/`): 측 세그먼트+관계 다중필터 드롭다운+그룹 스위치+
  식대 단가 입력(`couple.meal_price`)+엑셀 가져오기/내보내기(SheetJS+Expo 공식 모듈, ADR-0006).
  참석 상태는 행의 칩을 탭해 순환(`set_attend_status`). 축의금은 지출 원장과 상계하지 않는 별도
  수입으로 하객 화면+홈 대시보드 양쪽에 노출.
- **갤러리**(`app/gallery.tsx`+`features/gallery/`): 사진만(영상 범위 밖)·기기 갤러리 선택 업로드만
  (카메라 범위 밖). 영역 필터+3열 썸네일 그리드+전체화면 보기/삭제+상단 통계(전체 장수·원본 보관
  용량)+Storage 1GB 80% 이상 경고 배너. Storage는 `couple.id` 경로 접두사 RLS로 클라이언트가
  직접 업로드/다운로드/삭제(ADR-0007, RPC 게이트웨이의 유일한 예외) — `photo` 행 자체는
  `create_photo`/`delete_photo` RPC. 2026-11-16 추가: **다중 사진 선택 업로드**, 그리드 **다중 선택
  모드**(상단 "선택" 토글→썸네일 체크 오버레이→하단 액션바)로 여러 장을 **사진첩 저장**
  (`expo-media-library/legacy`)·**순차 공유**(`expo-sharing`, 한 번에 한 장 제약이라 선택 장수만큼
  공유 시트를 `await`로 차례로 염). 저장/공유 RN 글루는 하객 `excel-io.ts`와 동일하게
  `features/gallery/transfer.ts`에만 네이티브 모듈을 격리.

갤러리는 설계 스펙(`docs/superpowers/specs/2026-11-13-phase2-gallery-slice-design.md`)+계획
(`docs/superpowers/plans/2026-11-13-phase2-gallery-slice.md`, 12 Task)을 먼저 쓰고, Task마다
implementer→스펙 검토→코드 품질 검토 서브에이전트 순으로 진행했다(`superpowers:
subagent-driven-development`). 다운로드/공유는 실기기 테스트 중 사용자가 제기한 요청으로, 같은
세션에서 브레인스토밍(선택 UX·다운로드 방식·다중 공유 처리 3가지 질문)→계획→구현했다.

## 이슈

- **Storage RLS가 `couple` 테이블 자체 RLS 때문에 insert/delete를 항상 거부**(갤러리, Critical) —
  정책 본문의 서브쿼리가 `anon` 권한으로 돌아 `couple`을 0행으로 봐서다.
- **`expo-image-picker`의 `MediaTypeOptions.Images`가 폐기돼 런타임 경고**(갤러리).
- **영역 필터의 "빈 상태" 판단이 전체 데이터 기준이라, 선택한 영역만 비면 안내 문구 없이 완전히
  빈 화면이 됨**(업체) — 체크리스트·갤러리가 이미 쓰던 "필터링 후 데이터 기준" 패턴을 아직 안
  옮긴 게 원인.
- **중첩 Pressable이 웹에서 `<button>` 안 `<button>` hydration 에러**(업체,
  `VendorContractPanel`) — 카드 전체 Pressable 안에 보조 액션 Pressable을 또 넣은 게 원인.
- **사진첩 뷰어의 "닫기" 버튼이 어두운 오버레이 위에서 안 보임**(갤러리, 2026-11-16 사용자 실기기
  테스트 제기) — `ghost` variant의 `ink`(어두운) 텍스트를 어두운 배경에 그대로 써서 대비가
  사라졌다.
- **사진 업로드가 한 장씩만 가능**(갤러리, 2026-11-16 사용자 실기기 테스트 제기) —
  `launchImageLibraryAsync`에 다중 선택 옵션이 처음부터 빠져 있었다.
- **SDK 58부터 `expo-file-system`·`expo-media-library` 기본 export가 클래스 기반 신규 API로 바뀌어
  문자열 uri 함수가 `/legacy` 서브패스에만 남음**(갤러리, `transfer.ts` 작성 중 eslint로 발견).

## 트러블슈팅

- **업체 영역 필터 빈 화면**: 7단계 실측 체크리스트를 돌리던 중 웨딩홀(업체 0건) 선택 시 재현.
  `hasAny`가 `groups.some(...)`로 전체 영역 기준이라, 선택 영역이 비어도 안내 문구 조건엔 안
  걸리면서 각 그룹의 `return null`로 아무것도 안 그려졌다. `hasVisibleVendors(groups, areaFilter)`로
  교체, 회귀 테스트(`api.test.ts` 4건) 동반 수정.
- **Pressable 중첩 hydration 에러**: 브라우저 콘솔에서 React 19 hydration 경고로 재현. 카드를
  `View`+형제 `Pressable` 2개로 재구조화.
- **Storage RLS 항상 거부**: 코드 리뷰 단계에서 정책 본문의 서브쿼리가 호출자 권한(`anon`)으로
  도는 Postgres RLS 동작을 재확인하고, `couple_exists(text) returns boolean security definer`
  함수로 분리해 해결(`0008_gallery.sql`).
- **갤러리 닫기 버튼 대비**: 사용자가 올린 실기기 스크린샷에서 "닫기" 텍스트가 안 보이고 원형
  테두리만 보이는 것을 확인 → `Button`의 `ghost` variant가 어떤 색 토큰을 쓰는지 추적해 `ink`
  텍스트+`lineStrong` 보더(둘 다 밝은 배경 전제)임을 특정 → 어두운 배경 전용
  `ghostOnDark`(흰 텍스트+흰 보더) variant를 추가해 해결.
- **`saveToLibraryAsync not found in imported namespace`(eslint)**: `expo-media-library`의
  `build/index.d.ts`가 `next`(클래스 기반) API만 재export함을 `node_modules` 타입 정의를 직접
  읽어 확인 → `/legacy` 서브패스에 문자열 uri 함수가 그대로 있음을 발견 → import 경로 교체로 해결.
- **웹 프리뷰에서 네이티브 OS 파일 선택 창이 열려 스크린샷이 멈춤**: "사진 추가" 버튼을 실제로
  클릭하면 가짜 `<input>` 우회가 아니라 진짜 OS 다이얼로그가 뜬다는 것을 스크린샷 타임아웃으로
  알아챔(`javascript_tool`은 정상 응답해 렌더러 자체는 안 멈췄음을 확인) → 선택 모드 UI는 버튼
  클릭 대신 React Query 캐시에 `setQueryData`로 가짜 사진을 주입해 우회 검증.

## 사이드 이펙트 및 조치

- 체크리스트·일정·비용·하객·업체·갤러리 6개 feature 전부 뮤테이션 `onError`에서 롤백+`Alert`로
  실패 사유를 보여주도록 통일(마이그레이션 미적용이 "저장했는데 사라짐"으로 보였던 사례 재발
  방지).
- 갤러리 `Button` 컴포넌트에 `ghostOnDark` variant 추가 — 기존 `ghost`/`primary`는 그대로 두고
  어두운 배경 전용 분기만 보탰다(다른 화면 영향 없음).
- 갤러리 업로드 플로우가 단일 선택(`pickImage`→`PickedPhoto`)에서 다중 선택
  (`pickImages`→`PickedPhoto[]`)으로 바뀌면서 `useUploadPhoto`도 순차 업로드로 변경 —
  `onSuccess`를 `onSettled`로 바꿔 일부 실패해도 그 전까지 성공한 사진은 캐시에 반영되게 했다.

## 검증 결과

- **업체**: `npx tsc --noEmit`/`jest`(203개)/`eslint` 0에러. 2026-11-13 웹 프리뷰+브라우저
  자동화로 기본 CRUD→계약 전환→수정/되돌리기→역할 필드 게이팅→삭제 가드(DB 409 거부)→
  "비용에서 보기" 딥링크→영역 필터 7단계 전부 실측 통과. 사용자 승인 완료.
- **하객**: `npx tsc --noEmit`/`jest`/`eslint` 0에러. CRUD+측·관계 필터·그룹 동작, 금액 입력
  100원 단위 정밀도(`lib/money.ts`) 실측. 사용자 승인 완료.
- **갤러리**: `npx tsc --noEmit`/`jest`(220개+이번 세션 추가분 29개, 합 249개)/`eslint` 0에러.
  2026-11-13~14 웹 프리뷰+브라우저 자동화로 업로드→Storage 저장→그리드 반영→전체화면 보기→삭제→
  영역 필터 전부 실측. 2026-11-16: 닫기 버튼 대비·다중 선택 업로드·사진첩 저장·순차 공유를 사용자
  실기기(Expo Go)에서 직접 테스트해 전부 확인·승인받음(재현 버그 2건은 그 자리에서 수정 후
  재테스트로 승인). 선택 모드 UI(토글·체크 오버레이·액션바·FAB 숨김)는 React Query 캐시 주입으로
  웹에서도 보강 검증.

## 미검증으로 남은 것

- **Realtime 2기기 교차 반영**(업체·하객·갤러리 공통, Phase 1부터 이어짐) — 브로드캐스트 채널
  인프라는 실측됐지만 두 기기로 동시에 써서 교차 반영되는지는 두 사람이 함께 쓰기 시작하는 시점에
  확인한다.
- **하객 엑셀 가져오기/내보내기의 실기기 플로우** — 순수 파싱(`guest-excel.ts`, 병리 입력 포함)은
  단위테스트로 검증됐지만, `expo-document-picker`로 실제 파일을 고르고 `expo-sharing`으로 공유
  시트를 여는 동작은 실기기에서 확인된 적 없다.
- **갤러리 800MB 용량 경고 배너의 실제 노출** — 경계값 단위테스트(799MB/800MB)로만 검증됐고,
  서비스 롤 키 없이 `size_bytes`를 강제로 키울 방법이 없어 사진이 자연스럽게 쌓이는 시점에
  확인한다.

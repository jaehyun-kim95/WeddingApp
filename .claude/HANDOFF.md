# HANDOFF

다음 세션이 이 프로젝트를 바로 이어받기 위한 진입점. **사실 자체는 여기 적지 않는다** — 최신 상태의
단일 출처는 언제나 `CLAUDE.md`다. 여기는 "어디부터 읽고 무엇을 먼저 할지"만 안내한다.

## 0. 한 줄 현황

**Phase 0~2 전부 완료 + Phase 3 중 모아보기·설정·백업·알림 실구현 완료**(`main`, 2026-11-17 세션
종료 시점) — 전부 사용자 실기기 승인까지 끝났다. 이 세션에서 실기기 테스트 중 **버그 3건을
발견 즉시 수정**했다(§2): Android Expo Go의 `DocumentPicker`+`FileSystem` 읽기 권한 불일치,
`restore_couple_backup`의 PL/pgSQL 변수명 충돌, 좁은 화면에서 달력 날짜 배지가 다음 줄 위로
번지던 레이아웃 버그. **길일(吉日) 표시는 사용자가 영구히 사용 안 함으로 확정**했다(`01` 범위
밖으로 이동, 메커니즘은 코드에 그대로 둠). **Realtime 2기기 교차 반영도 사용자가 실기기로 직접
확인 완료**했다 — 더 이상 열린 질문이 아니다.

**다음 세션 최우선 작업**: Phase 3 마지막 조각인 **표준 시드 콘텐츠 작성**(한국 결혼준비 표준
체크리스트·로드맵) 착수 여부를 사용자에게 먼저 묻는다(§4). 그 외엔 전부 "사용자가 실기기로
확인해 줘야 닫히는" 미검증 항목뿐, 코딩 착수가 필요한 열린 질문은 이제 표준 시드 하나뿐이다.

**이 프로젝트의 작업 범위 원칙(사용자 결정 2026-11-17)**: 상용 배포가 아니라 작성자+애인 둘만
쓰는 개인 실사용 앱이다. 리포트된 버그는 근본 원인까지 끝까지 추적해 제대로 고치되, "혹시 모를"
다른 기기·시나리오까지 선제적으로 방어하거나 완전 검증을 위해 dev build 도입 같은 걸 먼저
제안하지 않는다. 두 사용자의 실기기에서 "확인 완료"면 그게 검증의 종착점이다.

## 1. 먼저 읽을 것 (이 순서로)

1. `CLAUDE.md`의 **「현재 상태」·「진행 현황」·「알려진 이슈」·「아키텍처」** — 지금 어디까지 됐고
   다음에 뭘 할지 + RN 코드/Supabase/금액 입력 **함정**(단일 출처, `02-architecture.md` 「구현 함정」에
   모여 있다). 이번 세션에서 새로 생긴 함정 중 표준 시드 작업에서 재현되기 쉬운 것:
   - **`DocumentPicker`가 돌려준 `file://` URI를 `FileSystem.readAsStringAsync`로 읽으면 Android
     Expo Go에서 "isn't readable"로 거부된다**(`02` 「파일 피커로 고른 문서 읽기」) — 복사본이
     host 앱의 원시 cacheDir에 쓰이는데 읽기 권한 검사는 Expo Go의 실험별 샌드박스 경로만 허용해
     어긋난다. **새 파일 가져오기 기능도 `fetch(uri)`로 읽는다**, `FileSystem.readAsStringAsync`에
     피커 URI를 직접 넘기지 않는다.
   - **PL/pgSQL 함수에서 루프 변수명과 SQL 별칭이 같은 이름이면 `column reference "x" is
     ambiguous`로 거부된다**(`02` 「백업 feature」, `restore_couple_backup`에서 실측) — 새
     일괄 처리 RPC(표준 시드 불러오기가 바로 이런 함수다)를 쓸 때 짧은 변수명(`r`, `v` 등)이 같은
     함수 안의 다른 쿼리 별칭과 겹치지 않는지 먼저 확인한다.
   - **`@supabase/postgrest-js`는 네트워크/타임아웃으로 fetch 자체가 실패하면 `Error`를 상속하지
     않는 평범한 객체를 에러로 반환한다** — `e instanceof Error ? e.message : '...'` 패턴 대신
     `src/lib/error-message.ts`의 `getErrorMessage(e)`를 새 `onError` 핸들러에 재사용한다(지금은
     `backup`만 적용돼 있다).
   - **캘린더 날짜 셀의 배지+마커 예산**: 배지+마커 세로 합이 `(화면폭-72)/7`(셀 높이, 1/7 폭
     기준)을 넘으면 다음 줄 위로 번진다(`02` 「화면 목업」 인접 섹션, `calendar-view.tsx` 실측
     버그). 비슷한 "고정 높이 배지+가변 콘텐츠" UI를 새로 만들 때 암산으로 확인한다.
   - **표준 시드(`seed_checklist_item`/`seed_roadmap_step`) 테이블이 비어 있다** — 시드 불러오기를
     구현하면 콘텐츠(일반 통념 기준)를 함께 채워야 실제로 테스트할 수 있다. 길일(`auspicious_day`)
     은 더 이상 이 작업 대상이 아니다(위 §0, 영구 제외 확정).
   - **Supabase 마이그레이션은 CLI로 자동 적용되지 않는다** — `supabase/config.toml`이 없다(CLI
     링크 안 됨). 새 마이그레이션은 **사용자가 Supabase 대시보드 SQL Editor에 직접 붙여넣어
     실행**해야 한다.
2. **아홉 슬라이스 = 다음 화면의 템플릿**: `src/features/{checklist,schedule,budget,home,guests,
   vendors,gallery,couple,areas,backup,notifications}/`(`api.ts` 셀렉터+쓰기·`cache.ts` 낙관적
   캐시 리듀서·`hooks.ts` Query/Mutation+`Alert` 에러 표시·`components/`) 구조와
   `src/features/README.md`(도메인 파일 계약)를 먼저 본다. `backup`/`notifications`은 전형적인
   구조에서 조금 벗어난다(복원은 전체 교체라 낙관적 패치 없음, 알림은 RPC가 아예 없음) — 각자
   폴더 상단 주석이 이유를 설명한다.
3. **개발 계획**: `docs/04-dev-plan.md` Phase 3 — **모아보기+설정+백업+알림 전부 완료**, **표준
   시드만 착수 전(⬜)**.
4. **결정 이유**: `docs/decisions/` — ADR-0009(백업 복원=전체 교체)가 가장 최근.

## 2. 지난 작업(완료) — 백업/알림 구현 + 실기기 버그 3건

**세부 내역은 `docs/reports/phase-3-backup-notifications.md`(얼림)가 단일 출처다** — 여기 다시
적지 않는다. 다음 세션이 바로 알아야 할 결론만:

- **백업**: 하객 엑셀 I/O 3계층 패턴을 미러링해 내보내기/가져오기 구현. 복원은 전체 교체(ADR-0009).
  `restore_couple_backup` RPC는 **사용자 실기기로 복원까지 확인 완료**.
- **알림**: `expo-notifications`로 납부일 3일 전+당일 아침 9시 로컬 알림. 전량 재동기화 전략.
  Expo Go iOS 발화 자체는 미검증, Android 전체 경로는 dev build 필요해 범위 밖(사용자 결정).
- **실기기 버그 3건, 전부 그 자리에서 원인 추적→수정→재확인**:
  1. 백업/엑셀 가져오기가 Android Expo Go에서 `"isn't readable"`로 거부 → `fetch(uri)`로 읽도록
     변경(§1 참고). 백업은 실기기 재확인 완료, 엑셀은 같은 코드 경로라 미반영 상태로 남아있을
     가능성 낮음(별도 실측은 안 함).
  2. 복원 RPC가 `"column reference r is ambiguous"`로 실패 → PL/pgSQL 변수 개명(§1 참고).
  3. 일부 Android 기기에서 알림 채널 생성이 NullPointerException으로 거부돼 에러 화면까지 뜸 →
     try/catch 이중 방어.
  4. (버그는 아니지만 진단을 가로막던 문제) postgrest-js의 네트워크 실패 에러가 `Error`를 상속하지
     않아 "알 수 없는 오류"로만 보임 → `getErrorMessage` 유틸 신설(§1 참고).
- **길일 표시는 이 세션에서 영구히 사용 안 함으로 확정**(§0). `couple.notify_payments`/
  `show_auspicious_days`/`auspicious_day` 등 DB 쪽은 그대로 둔다.
- **Realtime 2기기 교차 반영도 이 세션에서 사용자가 실기기로 확인 완료** — 체크리스트·일정·비용·
  홈·하객·업체 전부 대상, 더 이상 미검증 항목이 아니다.

## 3. 로컬에서 확인하는 법

**Expo 개발 서버 — 반드시 사용자 본인 터미널에서 실행한다.** 이 세션(Claude Code Bash 도구)엔
TTY가 없어 `npx expo start`를 아무리 `--tunnel`/`--non-interactive`로 돌려도 QR·`exp://` 접속
URL이 안 찍힌다(실측으로 확인 — Expo CLI가 `stdout.isTTY`를 보고 인터랙티브 UI를 켠다). 실기기
테스트가 필요하면 **"터미널에서 `npx expo start --tunnel ngrok` 직접 실행해 달라"고 사용자에게
요청**한다.

**린트는 `npm run lint`(=`expo lint`)만 쓴다** — `npx eslint .`를 직접 돌리면 저장소 전체(빌드
산출물 등 비소스 포함)를 긁어 다수 오탐이 난다(2026-11-17 발견).

**웹 프리뷰로 화면만 확인할 땐**(`npx expo start --web --port <PORT>`) 백그라운드로 띄우고
`curl -o /dev/null -w "%{http_code}"`로 200이 뜰 때까지 폴링한 뒤 접속, **끝나면 반드시
`taskkill`로 정리**한다(포트 점유 채로 세션을 끝내지 않는다).

**버그 재현 루프(이번 세션에서 실제로 쓴 방식)**: 사용자가 실기기 스크린샷+증상을 캡처해 전달 →
관련 코드·설치된 라이브러리 소스(`node_modules`)까지 직접 읽어 원인 특정(추측 금지, 재현 우선
원칙 — 이번 세션의 네 버그 전부 이 방식으로 근본 원인을 정확히 찾았다) → 수정 → `tsc`/`jest`/
`lint` 전체 재검증 → 회귀 테스트 추가 → 사용자가 Expo Go에서 리로드 후 재확인 → 확인되면 커밋.

### 3-1. 브라우저 자동화(claude-in-chrome)로 검증할 때 — 노하우

- **스크린샷(`computer screenshot`)과 DOM `.click()`이 세션 중 간헐적으로 타임아웃/무반응**할 수
  있다(CDP 연결 플레이크니스로 추정). 증상이 나오면 **새 탭을 새로 만들어(`tabs_create_mcp`) 재시도**.
- **"사진 추가"처럼 `expo-image-picker`의 `launchImageLibraryAsync`를 실제로 트리거하는 버튼을
  클릭하면 진짜 OS 네이티브 파일 선택 창이 뜬다**(2026-11-16 실측) — 이 창이 열려 있는 동안 CDP
  스크린샷이 계속 타임아웃된다(`02-architecture.md` 갤러리 서브섹션에 상세 기록). 이 플로우를
  재현해야 할 땐 버튼을 직접 클릭하지 말고 **React Query 캐시에 `setQueryData`로 가짜 데이터를
  주입**하거나, `HTMLInputElement.prototype.click`을 미리 패치해 숨은 input에 `change` 이벤트를
  직접 디스패치한다(둘 다 네이티브 권한 UX 자체는 검증 못 한다 — 그건 실기기 전용).
- **React Query의 `queryClient`를 콘솔에서 찾는 법**: `document.getElementById('root')`에서
  React Fiber(`__reactFiber$*`/`__reactContainer$*` 키)를 타고 올라가며
  `memoizedProps.client`/`memoizedState.memoizedState`에 `getQueryCache`가 있는 노드를 찾는다.
  찾으면 `qc.getQueryCache().getAll()`로 쿼리 목록을 보고, `qc.setQueryData(key, data)`로 캐시를
  직접 조작해 네이티브 다이얼로그 없이 화면 상태를 재현할 수 있다.
- RN Web의 `Pressable`은 DOM 요소의 `.click()`으로 안 눌리는 경우가 있다 — `computer` 툴의 실제
  좌표 클릭을 우선 쓴다.
- **OS/브라우저 네이티브 팝업**은 CDP로 전혀 못 본다.
- **브라우저의 `localStorage.wedding.shareCode`가 이전 세션의 낡은/무효 코드로 남아있을 수 있다**:
  새 테스트 커플을 온보딩으로 새로 만들거나, `javascript_tool`로
  `localStorage.getItem('wedding.shareCode')` 확인 후 유효한 코드로 교체.

**디자인 목업**(`design/*.html`, 참조용): `file://`가 막히니 로컬 정적 서버 필요.

## 4. 열려 있는 질문 / 아직 정해지지 않은 것

- **표준 시드 콘텐츠 작성 착수 여부** — Phase 3의 마지막 남은 작업. 코드(seed RPC·테이블 조회·
  설정 화면 행)는 아직 하나도 없다. 콘텐츠(일반 통념 기준 한국 결혼준비 체크리스트·로드맵)부터
  작성해야 한다는 게 이미 사용자 결정(`CLAUDE.md` 「알려진 이슈」) — 착수 여부·범위만 다음 세션
  시작 시 재확인.
- **공유 코드 재발급 버튼의 확인 다이얼로그→전환 플로우 미검증**(2026-11-16) — RPC는 적용됐고
  `update_couple`은 실측했지만, 재발급 자체는 자동화로 검증하지 않았다. 실기기/수동 테스트 필요.
- **하객 엑셀 가져오기/내보내기 실기기 플로우 미검증**(사용자 확인 2026-11-12) — 순수 파싱(병리
  입력 포함)은 단위테스트 완료. 읽기 버그는 백업과 같은 패턴이라 이미 고쳤지만(§1·§2), 피커→
  공유시트까지의 전체 실기기 플로우 자체는 아직 별도로 확인 안 됨.
- **갤러리 800MB 용량 경고 배너의 실제 노출 미검증** — 경계값 단위테스트로만 확인. 서비스 롤 키
  없이 `size_bytes`를 강제로 키울 방법이 없어, 사진이 쌓이는 자연스러운 시점에 확인한다.
- **Expo Go(iOS) 납부일 알림 실제 발화·토글 on/off 예약/취소 미검증** — 코어 계산 로직은
  단위테스트 완료, 실기기 발화만 안 해봄.
- **백업 복원의 2기기 Realtime 수렴 미검증** — 복원은 같은 기기 왕복으로만 확인됨. 파트너 세션에
  즉시 반영되는지는 두 기기로 동시에 써봐야 확인 가능.
- **갤러리 사진 원본 저장 위치** — Supabase Storage 무료 1GB(ADR-0002). 용량 경고 UI는 구현
  완료, 실제로 외부 저장소로 전환할지는 여전히 미정 — 임계값에 가까워지는 시점에 다시 판단한다.
- **탭바 아이콘** — DESIGN.md "드로운 SVG" 방향 확정, 현재는 라벨 전용(`src/components/tab-bar.tsx`).
  실제 아이콘 에셋은 미정 Phase에서.
- **실사용 배포 형태(독립 앱 빌드)** — 지금은 개발용 Expo Go로만 구동. Android는 EAS Build로 APK 무료
  생성이 유력, iOS는 Apple Developer 계정 제약. Phase 4(배포)에서 결정.
- **세부 기능은 구현하며 개선** — UI 승인은 "구조/방향". 계산 로직·입력 폼·엣지 케이스는 실테스트 후
  개선(사용자 방침 — 지금까지 모든 feature가 실기기/실측 테스트에서 추가 버그·요청을 드러냈다).
- **준비 로드맵 위젯** — 사용 안함 보류. `system.css`의 `.roadmap`/`.rstep`은 남겨둠. 임의 재배치 금지.
- **길일 표시 — 더 이상 열린 질문 아님**: 영구히 사용 안 함으로 확정됐다(§0). 되살릴 일이 생기면
  전통 역법 데이터 출처부터 다시 정해야 한다.

## 5. 이 문서 자체에 대해

HANDOFF.md는 **얼리지 않는다** — `CLAUDE.md`의 「현재 상태」가 바뀔 때마다 위 0·2·4번을 그 자리에서
고쳐 쓴다(지난 세션 기록을 덧붙이지 않는다). 세부 역사는 `docs/reports/phase-N.md`(얼림)에 맡기고,
여기는 항상 "지금 상태 + 다음에 뭘 할지"만 담는다. 사실이 어긋나면 `CLAUDE.md`가 이긴다.

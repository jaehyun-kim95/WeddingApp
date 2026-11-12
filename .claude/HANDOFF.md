# HANDOFF

다음 세션이 이 프로젝트를 바로 이어받기 위한 진입점. **사실 자체는 여기 적지 않는다** — 최신 상태의
단일 출처는 언제나 `CLAUDE.md`다. 여기는 "어디부터 읽고 무엇을 먼저 할지"만 안내한다.

## 0. 한 줄 현황

**Phase 0(기반)·Phase 1(체크리스트·일정·비용·홈) 완료 + Phase 2 중 하객 관리 실구현·실기기 검증
완료**(`main`에 푸시됨, 커밋 `388b801`·`4dcc306`·`f294fc2`·`d939fa0`). 하객의 **엑셀 가져오기/
내보내기(파일 피커·공유 시트)만 실기기 미검증**으로 남아 있다(순수 파싱 로직은 단위테스트 완료).
**다음 코딩 작업은 업체(vendors)** — 사용자가 "업체와 어떤 개발이 남았지?"를 물어 범위를 이미
설명했고, 다음 세션 시작 시 **"설계 인터뷰부터 할지, 바로 구현으로 들어갈지"를 먼저 사용자에게
물어야 한다**(지난 세션에서 질문만 던지고 답을 못 받은 채 끝남 — §2 참고).

## 1. 먼저 읽을 것 (이 순서로)

1. `CLAUDE.md`의 **「현재 상태」·「진행 현황」·「알려진 이슈」·「아키텍처」** — 지금 어디까지 됐고
   다음에 뭘 할지 + RN 코드/Supabase/금액 입력/하객 feature **함정**(단일 출처, `02-architecture.md`
   「구현 함정」에 모여 있다). 특히 아래 세 가지는 업체 작업에서 바로 재현될 수 있는 함정이라
   꼭 먼저 본다:
   - **탭 밖 push 화면 패턴**(`02` RN 앱 코드 섹션) — 업체 화면도 하객과 같은 `_layout.tsx` 루트
     `Stack`(`headerShown:true`) 아래 push 화면이다. 네이티브 헤더가 이미 제목+뒤로가기를 그리므로
     화면 안에서 `PageHead`를 또 쓰지 않는다. `Fab`는 `bottomInset={useSafeAreaInsets().bottom}`을
     반드시 넘긴다(`edges={['bottom']}` 자동 처리만으로는 실기기에서 FAB가 시스템 네비게이션 바와
     겹쳤다 — 실측으로 발견).
   - **금액 입력 공용 모듈**(`02` 「금액 입력」 섹션, `src/lib/money.ts`) — 업체의 "계약 견적(참고값)"
     입력도 금액이다. `sanitizeManInput`/`parseManInput`을 쓰고, `formatMan`은 이미 "만/억" 접미사를
     포함하니 호출부에서 또 붙이지 않는다(실측으로 4곳에서 "15억만" 중복 버그 발견·수정했다).
   - **Supabase 마이그레이션은 CLI로 자동 적용되지 않는다** — 이 저장소엔 `supabase/config.toml`이
     없다(CLI 링크 안 됨). 새 마이그레이션(`000N_*.sql`)은 **사용자가 Supabase 대시보드 SQL
     Editor에 직접 붙여넣어 실행**해야 한다. 안 하면 RPC가 없어서 저장이 "됐다가 조용히 사라지는"
     증상으로 나타난다(하객 0006, 비용 0005 INTERIM 둘 다 이 패턴으로 실측 발견). 체크리스트·
     일정·비용·하객 4개 feature의 `hooks.ts`는 이제 실패 시 `Alert`로 원인을 보여주므로, 마이그레이션
     미적용이면 저장 시도할 때 바로 에러 메시지가 뜬다(증상 진단이 전보다 쉬워졌다).
2. **체크리스트·일정·비용·홈·하객 다섯 슬라이스 = 업체의 템플릿**: `src/features/{checklist,schedule,
   budget,home,guests}/`(`api.ts` 셀렉터+쓰기·`cache.ts` 낙관적 캐시 리듀서·`hooks.ts` Query/Mutation
   +`Alert` 에러 표시·`components/`) 구조와 `src/features/README.md`(도메인 파일 계약)를 먼저 본다.
   **하객이 가장 최근·가장 완전한 예시**다(push 화면+FAB+네이티브 헤더+금액 입력까지 전부 겪었다).
3. **개발 계획**: `docs/04-dev-plan.md` 「Phase 2 — 정보/장부」 — 업체·하객·갤러리 세 기능이 독립
   슬라이스로 분리돼 있다. 하객 체크박스는 거의 다 찼고(엑셀 실기기만 미검증), **업체 체크박스는
   전부 비어 있다**.
4. **결정 이유**: `docs/decisions/` — **ADR-0001(업체·비용 경계 — 업체는 정보 관리 전용, 금액
   소스 아님. 다음 작업이 바로 이 경계 위에 선다)**, ADR-0003(RLS RPC 게이트웨이), ADR-0006(엑셀
   I/O를 Expo 공식 모듈로 — 업체엔 해당 없지만 "커스텀 네이티브 모듈은 Expo Go에서 안 돈다"는
   교훈은 새 의존성을 고를 때마다 적용된다).
5. **데이터**: `docs/db/table-definitions.md`의 `vendor` 테이블(이미 0001에서 생성됨 — `area_id`·
   `name`·`status`(`vendor_status`: CANDIDATE/CONTRACTED)·`role`(`vendor_role`: STUDIO/DRESS/MAKEUP,
   **area=SDM일 때만 유효**)·`location`·`contract_date`·`quoted_price`(참고값, 금액 소스 아님)·
   `memo`). 쓰기 RPC는 `create_vendor(area_id,name)`만 있다(`0004_budget_writes.sql` — 비용 화면의
   "새 업체 인라인 생성"용 최소 버전, `status`가 `'CONTRACTED'`로 고정돼 있어 업체 화면 자체의
   "업체 추가"(후보로 시작)엔 못 쓴다). `update_vendor`·`delete_vendor`·풀 옵션 `create_vendor`(또는
   새 이름의 별도 함수)가 전부 없다 — 다음 마이그레이션은 `0007_vendor_writes.sql`.
6. **화면 구현 시**: `design/vendors.html`(승인된 목업) — 영역 필터(전체/웨딩홀/스드메/예단예물/
   신혼집, 체크리스트 `AreaFilter` 패턴) + 영역별 섹션(계약 확정 패널, **영역 하나에 여러 개 가능**
   — 스드메=스튜디오/드레스/메이크업 3개 동시 계약이 표준 케이스) + 후보 리스트 + "비용에서 보기"
   링크(계약 패널에서 비용 화면으로 네비게이션, 금액 상세는 거기서만 본다) + FAB "업체 추가".

## 2. 다음 작업 — 업체(vendors) 착수 전 확인할 것

**세션 시작하자마자 사용자에게 먼저 물을 것**: 하객처럼 "설계 인터뷰(브레인스토밍/Plan 모드로
모호한 지점을 질문)부터 할지, 범위가 이미 명확하니 바로 구현으로 들어갈지". 업체는 ADR-0001로
경계가 이미 확정돼 있고 목업도 승인돼 있어 하객만큼 설계 분기가 많지 않을 수 있지만, 아래 지점은
실제로 사용자 판단이 필요하다(추측하지 말 것):
- **`create_vendor`를 어떻게 확장할지** — 기존 비용용 최소 버전(`status='CONTRACTED'` 고정)을 그대로
  두고 업체 화면 전용 새 함수를 추가할지, 하나의 함수로 통합(옵션 파라미터 default)할지.
- **후보→계약 전환 UX** — 목업엔 "후보" 리스트와 "계약 확정" 패널이 시각적으로 분리돼 있다(상태값
  토글이 아니라 다른 섹션). 상태 변경을 어떤 조작으로 할지(행 탭? 전용 버튼?) 목업엔 인터랙션이
  없어 정해야 한다.
- **"비용에서 보기" 링크의 실제 목적지** — 특정 업체에 묶인 지출로 바로 스크롤/하이라이트할지,
  그냥 비용 탭으로만 이동할지.

착수 순서는 하객과 동일한 패턴을 권장(검증된 결과물):
1. Wave 0(메인 직접): `0007_vendor_writes.sql`(`create_vendor` 확장 또는 신설 + `update_vendor` +
   `delete_vendor`) → **사용자가 Supabase SQL Editor에서 직접 실행**(여기서 끝내지 않는다) →
   `lib/rpc.ts` 래퍼 → `features/vendors/{api,cache,hooks,types}.ts` 계약.
2. Wave 1(서브에이전트, 필요시 병렬): 컴포넌트(영역 필터는 `checklist/components/area-filter.tsx`
   그대로 재사용 가능 — 새로 안 만든다) + `app/vendors.tsx` 실화면.
3. 메인이 매 웨이브 `tsc`/`jest`/`eslint` 0 확인(전체 레포 기준, 부분 아님).
4. 완료 후 `docs/04-dev-plan.md` 업체 체크박스 + `CLAUDE.md` 「현재 상태」 갱신. 업체·하객·갤러리
   **셋 다 끝나야** `docs/reports/phase-2-dev.md`를 얼린다(하객만으론 아직 안 쓴다 — 지금은 `04`가
   사실 출처).

## 3. 로컬에서 확인하는 법

**Expo 개발 서버 — 반드시 사용자 본인 터미널에서 실행한다.** 이 세션(Claude Code Bash 도구)엔
TTY가 없어 `npx expo start`를 아무리 `--tunnel`/`--non-interactive`로 돌려도 QR·`exp://` 접속
URL이 안 찍힌다(실측으로 확인 — Expo CLI가 `stdout.isTTY`를 보고 인터랙티브 UI를 켠다). 실기기
테스트가 필요하면 **"터미널에서 `npx expo start --tunnel ngrok` 직접 실행해 달라"고 사용자에게
요청**한다. 이쪽에서 먼저 띄웠다가 포트(8081)를 점유한 채로 끝내지 않도록 `taskkill`로 정리하고
넘긴다.

**버그 재현 루프(이번 세션에서 실제로 쓴 방식)**: 사용자가 실기기 스크린샷+증상을 캡처해 전달 →
관련 코드를 직접 읽어 원인 특정(추측 금지, 재현 우선 원칙) → 수정 → `tsc`/`jest`/`eslint` 전체
재검증 → 사용자가 Expo Go에서 리로드 후 재확인. 브라우저 자동화(claude-in-chrome)는 이번 하객
작업에선 쓰지 않았다 — 아래 §3-1(이전 세션의 브라우저 자동화 노하우)은 웹 프리뷰로 검증할 때만
참고한다.

### 3-1. (이전 세션 — 웹 프리뷰/브라우저 자동화로 검증할 때만 해당)
- **브라우저 자동화로 검증할 때(claude-in-chrome)**:
  - 스크린샷(`computer screenshot`)과 DOM `.click()`이 **세션 중 간헐적으로 타임아웃/무반응**할 수 있다
    (CDP 연결 플레이크니스로 추정). 증상이 나오면 **새 탭을 새로 만들어(`tabs_create_mcp`) 재시도**.
  - RN Web의 `Pressable`은 DOM 요소의 `.click()`으로 안 눌리는 경우가 있다 — `computer` 툴의 실제
    좌표 클릭을 우선 쓰고, 막히면 `PointerEvent`/`MouseEvent`를 직접 dispatch하는 JS 헬퍼가 안정적.
  - **OS/브라우저 네이티브 팝업**은 CDP로 전혀 못 본다 — `CalendarPicker`를 커스텀 RN 모달로 만든
    이유.
  - Reanimated rAF 애니메이션은 스크린샷 타임아웃을 유발할 수 있다 — 로직/좌표는 DOM 실측으로
    먼저 검증.
- **Supabase RPC/격리 재검증**: 프로젝트 루트에서 `@supabase/supabase-js`로 `.env` 키를 읽어 RPC를
  직접 호출하는 1회용 Node 스크립트(`node --env-file=.env 스크립트.mjs`, Node 20+). **검증 끝나면
  스크립트와 테스트 데이터 삭제**.
- **브라우저의 `localStorage.wedding.shareCode`가 이전 세션의 낡은/무효 코드로 남아있을 수 있다**:
  PT401(무효)이면 CRUD가 에러 없이 조용히 실패한다(단, 이제 네 feature는 `Alert`가 뜬다 — 이 문제는
  더 쉽게 드러난다). `javascript_tool`로 `localStorage.getItem('wedding.shareCode')` 확인 후 유효한
  코드로 교체.
- **낙관적 반영 실패 롤백은 `window.fetch`를 임시로 패치해 유도할 수 있다**: 특정 RPC 엔드포인트
  URL만 `Promise.reject`하도록 감싸면 해당 mutation만 실패시켜 롤백을 실측할 수 있다. **테스트 후
  반드시 복원**.

**디자인 목업**(`design/*.html`, 참조용): `file://`가 막히니 로컬 정적 서버 필요.

## 4. 열려 있는 질문 / 아직 정해지지 않은 것

- **업체 설계 인터뷰 여부**(§2) — 다음 세션 시작 시 사용자에게 먼저 물어야 함, 아직 답 없음.
- **Realtime 두 기기 교차 반영 미검증**(Phase 1부터 이어짐, 사용자 확인 2026-11-11) — 코딩 작업이
  아니라 사용자가 파트너와 실제로 두 기기로 동시에 써보며 확인해야 하는 항목. 체크리스트·일정·비용·
  홈·하객 전부 대상.
- **하객 엑셀 가져오기/내보내기 실기기 플로우 미검증**(사용자 확인 2026-11-12) — 순수 파싱(병리
  입력 포함)은 단위테스트 완료, `expo-document-picker`/`expo-sharing` 실제 동작만 안 해봄.
- **갤러리 사진 원본 저장 위치** — Supabase Storage 무료 1GB(ADR-0002). Phase 2에서 1GB 근접 시 외부
  전환 결정. 지금 미정.
- **탭바 아이콘** — DESIGN.md "드로운 SVG" 방향 확정, 현재는 라벨 전용(`src/components/tab-bar.tsx`).
  실제 아이콘 에셋은 미정 Phase에서.
- **실사용 배포 형태(독립 앱 빌드)** — 지금은 개발용 Expo Go로만 구동. Android는 EAS Build로 APK 무료
  생성이 유력, iOS는 Apple Developer 계정 제약. Phase 4(배포)에서 결정.
- **세부 기능은 구현하며 개선** — UI 승인은 "구조/방향". 계산 로직·입력 폼·엣지 케이스는 실테스트 후
  개선(사용자 방침 — 하객에서도 실기기 테스트가 레이아웃·금액 정밀도·대시보드 범위 버그 세 건을
  추가로 드러냈다. 업체도 1차 구현 후 비슷한 피드백 루프를 예상할 것).
- **준비 로드맵 위젯** — 사용 안함 보류. `system.css`의 `.roadmap`/`.rstep`은 남겨둠. 임의 재배치 금지.

## 5. 이 문서 자체에 대해

HANDOFF.md는 **얼리지 않는다** — `CLAUDE.md`의 「현재 상태」가 바뀔 때마다 위 0·2·4번을 그 자리에서
고쳐 쓴다(지난 세션 기록을 덧붙이지 않는다). 사실이 어긋나면 `CLAUDE.md`가 이긴다.

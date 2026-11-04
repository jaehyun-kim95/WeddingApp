# HANDOFF

다음 세션이 이 프로젝트를 바로 이어받기 위한 진입점. **사실 자체는 여기 적지 않는다** — 최신 상태의
단일 출처는 언제나 `CLAUDE.md`다. 여기는 "어디부터 읽고 무엇을 먼저 할지"만 안내한다.

## 0. 한 줄 현황

**개발 Phase 0(기반) 기능 완료** — 디자인 토큰(다크 제거)·한글 폰트·공용 컴포넌트 7종·Supabase 격리
백엔드·네비 뼈대·온보딩까지 구현·검증(웹 실측). Supabase는 **연결 완료**(더 이상 블로커 아님). 남은 건
**Phase 0 게이트 2건**(expo-doctor 버전 정렬·실기기 확인)과 그 다음 **Phase 1 코어 화면**이다.

## 1. 먼저 읽을 것 (이 순서로)

1. `CLAUDE.md`의 **「현재 상태」**, **「진행 현황」**, **「아키텍처」** — 지금 어디까지 됐고 다음에 뭘 할지 +
   RN 코드/Supabase **함정**(단일 출처). 특히 「아키텍처」의 RN·Supabase 절은 모르면 깨뜨린다.
2. **개발 계획**: `docs/04-dev-plan.md` — Phase별 검증 체크리스트. 지금은 **Phase 0 게이트 마무리 → Phase 1**.
3. **결정 이유**: `docs/decisions/` — ADR-0001(비용·업체 경계)·0002(스택)·**0003(RLS RPC 게이트웨이 =
   데이터 접근의 핵심 계약)**. 커플 데이터는 전부 `src/lib/rpc`를 통해서만 접근한다.
4. **데이터**: `docs/db/`(ERD·테이블/코드 정의서·RLS). 스키마 v1은 `supabase/migrations/0001_init.sql`로
   실제 반영됨. **흐름**: `docs/flows/`(6개 프로세스 도식).
5. **화면 구현 시**: `DESIGN.md`(색·타이포·컴포넌트 규범) + `design/*.html`(승인된 9개 화면 목업 = 참조).
   `CLAUDE.md` 「네비게이션 모델」 준수. 공용 컴포넌트는 `src/components/ui/`에 이미 있다(재사용).
6. **직전 작업 설계 스펙**: `docs/superpowers/specs/` (디자인 토큰 등).

## 2. 다음 작업

### (a) Phase 0 게이트 2건 마무리 — 기능은 이미 완료
- ⬜ **`npx expo-doctor` 통과**: SDK 58 내 패치/마이너 드리프트 7건(선존). `npx expo install --check`로
  정렬하면 통과한다. **라이브러리 버전 변경이라 사용자 확인 후** 실행(사용자에게 아직 승인 안 받음).
- ⬜ **실기기/시뮬레이터 확인**: 웹 프리뷰로 대체 실측은 통과했으나 실기기 확인이 남음. 사용자가 직접
  `! npx expo start` 후 Expo Go로 QR 접속해 확인(내가 기기 연결 불가). 되면 Phase 0 완료 → `04`
  체크박스 채우고 `docs/reports/phase-0.md`(얼림) 작성.

### (b) Phase 1 — 코어 화면 (홈·일정·체크·비용 실데이터 CRUD)
`04-dev-plan.md` Phase 1. 뼈대는 다 섰고 지금은 전부 **플레이스홀더**(`src/app/(tabs)/*`)라 실데이터로
채우는 일이 남았다. 착수 전 준비:
- **읽기 훅**: `get_couple_snapshot`을 TanStack Query로 감싸는 훅 신설(queryKey `['snapshot', shareCode]`
  — `use-couple-realtime`이 이 키를 무효화하도록 이미 배선됨). `lib/rpc.getCoupleSnapshot` 사용.
- **쓰기 RPC 추가**(ADR-0003 패턴): 화면별 `create_*`/`update_*`/`delete_*`를 **새 마이그레이션**
  (`supabase/migrations/0002_*.sql`)으로 추가하고 `lib/rpc`에 래퍼. 커플 테이블/컬럼을 건드리면
  **스냅샷 함수·쓰기 RPC·Broadcast 트리거 3곳**을 함께 고친다(CLAUDE.md 함정).
- **화면 실구현**: 체크리스트(영역 필터·완료 토글)·일정(캘린더/리스트)·비용(원장·분담·집계)·홈(D-day
  센터피스·집계). `design/*.html`에서 수치·레이아웃을 옮겨온다. 세부 기능은 실테스트하며 개선(사용자 방침).
- **탭바 드로운 SVG 아이콘**(현재 라벨 전용) — Phase 1 폴리시로 이월됨.

## 3. 로컬에서 확인하는 법

**Expo 앱**: `npx expo start` → Metro. 기기 Expo Go/개발빌드로 QR, 또는 `npx expo start --web`로 브라우저
프리뷰. `.env`(gitignore됨)에 `EXPO_PUBLIC_SUPABASE_URL`/`_KEY`가 있어야 Supabase가 붙는다(이미 설정됨).
- **웹 프리뷰 검증 팁**: 확장프로그램 스크린샷이 Reanimated rAF로 타임아웃되면 **DOM/ref 기반 실측**으로
  우회한다(`javascript_tool`로 `document.body.innerText`·`getBoundingClientRect`, `read_page`로 ref 클릭).
  `expo-secure-store`는 웹 미지원이라 공유코드 저장은 `share-code.web.ts`(localStorage)가 대신한다.
- **Supabase RPC/격리 재검증**이 필요하면: 프로젝트 루트에서 `@supabase/supabase-js`로 `.env` 키를 읽어
  `create_couple`/`get_couple_snapshot`을 호출하는 1회용 Node 스크립트(ESM, 루트에 둬야 node_modules 해소).

**디자인 목업**(`design/*.html`, 참조용): `file://`가 막히니 로컬 정적 서버 필요(Node 한 줄 서버로 `design/`
서빙 후 `http://127.0.0.1:PORT/<파일>.html`, 모바일 폭).

## 4. 열려 있는 질문 / 아직 정해지지 않은 것

- **expo-doctor 버전 드리프트 7건** — `npx expo install --check` 정렬 여부 사용자 확인 대기(위 2-a).
- **갤러리 사진 원본 저장 위치** — Supabase Storage 무료 1GB(ADR-0002). Phase 2에서 1GB 근접 시 외부
  전환 결정. 지금 미정.
- **탭바 아이콘** — DESIGN.md의 "드로운 SVG" 방향 확정. 현재 라벨 전용, 실제 아이콘 에셋은 Phase 1에서.
- **세부 기능은 구현하며 개선** — UI 승인은 "구조/방향". 계산 로직·입력 폼·엣지 케이스는 실테스트 후 개선.
- **준비 로드맵 위젯** — 사용 안함 보류. `system.css`의 `.roadmap`/`.rstep`은 남겨둠. 임의 재배치 금지.
- **테스트 데이터** — 검증 중 만든 커플은 사용자가 삭제함. 웹 프리뷰의 가짜 공유코드는 브라우저
  localStorage에만 있었음(DB 무관).

## 5. 이 문서 자체에 대해

HANDOFF.md는 **얼리지 않는다** — `CLAUDE.md`의 「현재 상태」가 바뀔 때마다 위 0·2·4번을 그 자리에서
고쳐 쓴다(지난 세션 기록을 덧붙이지 않는다). 사실이 어긋나면 `CLAUDE.md`가 이긴다.

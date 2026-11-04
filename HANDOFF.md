# HANDOFF

다음 세션이 이 프로젝트를 바로 이어받기 위한 진입점. **사실 자체는 여기 적지 않는다** — 최신 상태의
단일 출처는 언제나 `CLAUDE.md`다. 여기는 "어디부터 읽고 무엇을 먼저 할지"만 안내한다.

## 0. 한 줄 현황

설계(1·2단계)·스택·데이터·개발계획 **전부 완료**, Expo 프로젝트 **생성·push 완료**
(github.com/jaehyun-kim95/WeddingApp). **다음은 개발 Phase 0** — 단, **Supabase 연결 작업은
사용자가 Supabase 프로젝트를 먼저 만들어야** 시작할 수 있다(아래 2·4 참고).

## 1. 먼저 읽을 것 (이 순서로)

1. `CLAUDE.md`의 **「현재 상태」**, **「진행 현황」** — 지금 어디까지 됐고 다음에 뭘 할지(최신 단일 출처).
2. **개발 계획**: `docs/04-dev-plan.md` — Phase 0~4 순서 + 각 Phase **검증 체크리스트**(전부 통과해야 다음).
   지금은 **Phase 0**이 대상.
3. **구조**: `docs/02-architecture.md` 「디렉터리 구조/계층」 + 「기술 스택」. 코드는 `src/`(Expo Router,
   파일=화면), 코어는 `features/`·`lib/`, 커플 데이터 접근은 전부 `lib/rpc`(공유코드 주입).
4. **데이터**: `docs/db/`(ERD·테이블/코드 정의서·RLS) — 스키마 v1. **흐름**: `docs/flows/`(6개 프로세스 도식).
5. **결정 이유**: `docs/decisions/` — ADR-0001(비용·업체 경계), ADR-0002(스택: Expo+Supabase, Auth 없는 RLS).
6. **화면 구현 시**: `DESIGN.md`(색·타이포·컴포넌트 규범) + `design/*.html`(승인된 9개 화면 목업 = 참조).
   `CLAUDE.md` 「네비게이션 모델」(더보기=메뉴허브 `more`, 설정=톱니, 모아보기=`areas`) 준수.

## 2. 다음 작업 — 개발 Phase 0

`04-dev-plan.md` Phase 0가 목표. 산출물: 앱이 기기에서 5탭+서브화면을 오가고, 공유 코드로 Supabase에
접속해 빈 데이터를 읽는 상태 + 디자인 토큰·공용 컴포넌트.

**Supabase 없이 먼저 할 수 있는 것**(블로커 없음):
- `src/constants/theme.ts`를 **DESIGN.md 토큰**(색·타이포 11단계·간격·반경)으로 교체.
- 공용 컴포넌트 프리미티브(`chip`·`meter`·`fab`·`list-row`·`switch`·`segmented`·`page-head`) —
  **터치 타겟 히트 영역 ≥24×24px**(phase-2.md 미검증 항목 해소).
- 네비 뼈대: `app/(tabs)/_layout.tsx`(NativeTabs 5개) + 루트 Stack에 서브 화면 + `onboarding`.
  scaffold 예제(`app/explore.tsx`, `components/animated-icon`·`app-tabs`·`hint-row`·`web-badge`·
  `external-link`)는 교체/제거. 재사용 가능: `themed-text`·`themed-view`·`ui/collapsible`.

**Supabase 필요 — 사용자 선행 작업 있음**(아래 4번):
- `lib/supabase.ts`(anon 클라)·`lib/rpc.ts`(공유코드 게이트웨이)·`lib/share-code.ts`·`lib/query-client.ts`.
- Supabase 프로젝트에 **스키마 v1 마이그레이션 적용**(`docs/db/table-definitions.md`) + area·시드 투입.
- `types/db.ts`(03 → TS 타입), 공유코드 온보딩 화면.
- **ADR-0003 작성**: RLS RPC 게이트웨이 함수 설계(`docs/db/access-control-rls.md`가 플래그한 항목) —
  Supabase 접근 코드 짜기 전에 먼저 확정.

**진행 순서 제안**: 디자인 토큰·공용 컴포넌트·네비 뼈대(블로커 없음)부터 시작하고, 사용자에게 Supabase
프로젝트 생성을 요청해 URL+anon 키를 받은 뒤 Supabase 파트로 넘어간다.

## 3. 로컬에서 확인하는 법

**Expo 앱**(실제 코드): `npx expo start` → Metro 개발 서버. 기기의 Expo Go 또는 개발빌드로 QR 접속,
또는 `npx expo start --web`로 브라우저 미리보기. 건전성: `npx expo-doctor`(scaffold 시 20/20 통과).
**주의**: scaffold 예제 파일에 `npx tsc --noEmit` 에러 3건이 있으나 전부 교체 대상 예제이고
`expo-env.d.ts` 미생성 탓 — 실제 화면 구현 시 해소된다. `expo start`가 `expo-env.d.ts`를 생성한다.

**디자인 목업**(`design/*.html`, 참조용): `file://`가 막히므로 로컬 정적 서버 필요 —
```bash
cd design && node -e "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((q,s)=>{let p=path.join(__dirname,decodeURIComponent(q.url.split('?')[0]));if(p.endsWith('/'))p=path.join(p,'index.html');fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);s.end();return;}const t={'.html':'text/html','.css':'text/css'};s.writeHead(200,{'Content-Type':t[path.extname(p)]||'text/plain'});s.end(d);});}).listen(8080,()=>console.log('8080'));"
```
그 뒤 `http://127.0.0.1:8080/<파일>.html`(모바일 폭). 스크린샷이 스크롤 직후 타임아웃되면 재시도 2~3회
후 DOM 실측(`javascript_tool`)으로 우회. **SVG 단독 페이지는 확장프로그램 스크린샷이 안 되니** `<img>`로
감싼 HTML로 확인한다(흐름도 검증 때 쓴 방법).

## 4. 열려 있는 질문 / 아직 정해지지 않은 것

- **🔑 Supabase 프로젝트 — 사용자 생성 필요(Phase 0 블로커)**: 내가 대신 가입/생성할 수 없다. 사용자가
  supabase.com에서 프로젝트를 만들고 **Project URL + anon public 키**를 알려줘야 Supabase 연결을 시작한다.
  키는 코드에 하드코딩하지 말고 `.env`(= `.gitignore`됨) + `app.config`/`expo-constants`로 주입한다.
- **ADR-0003(RLS RPC 게이트웨이 함수 설계)** — Phase 0에서 확정. 공유 코드 검증·함수 시그니처·에러·
  레이트리밋·코드 재발급 정책. `docs/db/access-control-rls.md`가 방향만 잡아둠.
- **갤러리 사진 원본 저장 위치** — Supabase Storage 무료 1GB 한도(ADR-0002 「결과」). Phase 2에서
  1GB 근접 시 외부(Google Drive 등) 전환 결정. 지금 미정.
- **세부 기능은 구현하며 개선** — UI 승인은 "구조/방향". 계산 로직·입력 폼·엣지 케이스는 실테스트 후
  개선(사용자 결정, 메모리 기록됨).
- **준비 로드맵 위젯** — 사용 안함 보류. `system.css`의 `.roadmap`/`.rstep`은 남겨둠. 임의 재배치 금지.

## 5. 이 문서 자체에 대해

HANDOFF.md는 **얼리지 않는다** — `CLAUDE.md`의 「현재 상태」가 바뀔 때마다 위 0·2·4번을 그 자리에서
고쳐 쓴다(지난 세션 기록을 덧붙이지 않는다). 사실이 어긋나면 `CLAUDE.md`가 이긴다.

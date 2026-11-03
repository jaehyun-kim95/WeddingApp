# HANDOFF

다음 세션이 이 프로젝트를 바로 이어받기 위한 진입점. **사실 자체는 여기 적지 않는다** — 최신 상태의
단일 출처는 언제나 `CLAUDE.md`다. 여기는 "어디부터 읽고 무엇을 먼저 할지"만 안내한다.

## 1. 먼저 읽을 것 (이 순서로)

1. `CLAUDE.md`의 **「현재 상태」**, **「진행 현황」** — 지금 어디까지 됐고 다음에 뭘 할지.
   세션마다 바뀌므로 이 파일(HANDOFF.md)이 아니라 거기가 최신이다.
2. `CLAUDE.md`의 **「아키텍처 — 비자명한 부분」** — 모르면 망가뜨리는 함정 목록. 특히:
   - `system.css` **공유 컴포넌트**(`.cal`/`.list`/`.seg`, `.fab`/`.fab-wrap`, `.app` flex) — 한
     화면만 보고 고치면 다른 화면도 조용히 바뀐다. 고칠 땐 쓰는 화면들을 모두 렌더해 회귀 확인.
   - **새 화면마다** `cream-palette`·`cramped-padding` 예외를 `.impeccable/config.json`에 재등록해야
     검출 0건이 된다(파일명 단위 예외).
3. `DESIGN.md` 전체 — 화면 UI 작업 전 필수. 색·타이포·컴포넌트 규범의 단일 출처. 특히 **One-Axis
   Color Rule**(한 화면 한 색축), FAB, 업체 계약 패널, 비용 업체 묶음 절.
4. `docs/decisions/0001-cost-vendor-boundary.md` — **업체·비용 경계**(비용=지출 원장, 업체=정보)
   결정. 둘 중 하나를 건드리면 먼저 읽는다.
5. 진행 중 화면의 `.impeccable/surfaces/<slug>.md`(있는 경우) — 화면별 디렉션 계약(홈 것만 있음).

## 2. 다음 작업 (현재 기준)

**현재: 2단계(UI/UX 설계) ✅ 완료 + 기술 스택 ✅ 확정(2026-11-03).**
- 2단계: 9개 화면 전부 승인 + 네비게이션 모델 확정 + `/impeccable audit` 전체 디자인 검토(17/20,
  Good) 완료, 발견한 결함 2건(탭바 죽은 링크·reduced-motion 누락) 수정 완료. 보고서: `docs/reports/phase-2.md`.
- 스택: **Expo(React Native) SDK 57 + Supabase(Auth 미사용, `anon` 키 + RLS 공유 코드 필터)**.
  비용은 사실상 무료, "로그인 없음"이 코드 구조 자체에 없는 것이 핵심. 상세: `docs/02-architecture.md`
  「기술 스택」 + [ADR-0002](docs/decisions/0002-tech-stack.md).

**다음: 3단계(개발) 준비 — 사용자 4단계 로드맵 진행 중**:
1. ✅ **테이블 설계 완료**(승인 2026-11-03) — DB 산출물은 **`docs/db/`** 폴더에 분리(ERD·테이블
   정의서·코드 정의서·RLS). `docs/03-data-model.md`는 포인터. 설계 판단 3건(area 테이블화·달력
   중복저장 금지·분담 행 저장) 사용자 승인됨. RLS 격리 함수 설계는 3단계에서 ADR-0003으로 확정 예정.
2. ⬜ **소스 디렉토리 설계 + `docs/04-dev-plan.md`** — 전체 폴더 구조 + 각 기능 프로세스 흐름도(도식)
   산출물 필요(사용자 요청). `phase-2.md`의 미검증 항목(체크박스류 터치 타겟 24×24px 미만 — 실인터랙션
   붙일 때 히트 영역 확장)도 dev-plan 작업 항목에 반영.
3. ⬜ `git init`.
4. ⬜ 실제 Expo 프로젝트 생성(`npx create-expo-app` 등) + 개발 진행.

네비게이션 모델(사용자 결정 2026-11-03): **더보기 탭=메뉴 허브(`more.html`)**, **설정=톱니(`.gear-btn`,
현재 홈·더보기 허브 두 곳)**, **모아보기=`areas.html`**(아코디언). CLAUDE.md 「네비게이션 모델」이 규범.
`more.html`(더보기 메뉴)과 `areas.html`(모아보기)을 혼동하지 말 것.

공유 컴포넌트(`system.css`)를 바꾸는 작업이면, 쓰는 화면을 모두 렌더해 회귀를 확인한다.

**화면**: 9개 전부 승인(홈·일정·체크리스트·비용·업체·하객·갤러리·모아보기`areas`·설정) + 더보기 허브.

## 3. 로컬에서 화면 확인하는 법

빌드 도구 없음. `design/*.html`은 정적 파일이고 이 환경은 `file://` 직접 열기를 막으므로 로컬
정적 서버가 필요하다.

```bash
# design/ 디렉토리에서 실행 — 포트는 비어있는 아무 번호나
cd design && node -e "
const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((req,res)=>{
  let p=path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
  if(p.endsWith('/')) p=path.join(p,'index.html');
  fs.readFile(p,(e,d)=>{
    if(e){res.writeHead(404);res.end('not found');return;}
    const ext=path.extname(p);
    const types={'.html':'text/html','.css':'text/css','.js':'text/javascript'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});
    res.end(d);
  });
}).listen(8080,()=>console.log('serving on 8080'));
"
```

그 다음 브라우저(Claude in Chrome 등)로 `http://127.0.0.1:8080/<파일명>.html` 접속, 모바일 폭으로
리사이즈해서 확인. 스크린샷 캡처가 스크롤 직후 타임아웃되는 환경 이슈가 가끔 있다 — 재시도 2~3회
후에도 안 되면 DOM 실측(`javascript_tool`로 `getBoundingClientRect`/`getComputedStyle`)으로 우회한다.

## 4. 열려 있는 질문 / 아직 정해지지 않은 것

- **세부 기능은 3단계로** — UI 승인은 "구조/방향"에 대한 것. 계산 로직·입력 폼·엣지 케이스 등 세부는
  3단계 개발에서 실테스트 후 개선(사용자 결정, 메모리 기록됨). 목업에서 세부 동작을 과하게 다듬지 않는다.
- **surface brief**: `.impeccable/surfaces/`에 홈 것만 있다. 없어도 작업 가능(impeccable context가
  자동 안내) — 필요하면 생성 고려.
- **준비 로드맵 위젯**: 사용 안함 보류(사용자 결정). `system.css`의 `.roadmap`/`.rstep`은 남겨둠.
  필요해지면 사용자가 먼저 꺼낸다 — 임의 재배치 금지.

## 5. 이 문서 자체에 대해

HANDOFF.md는 **얼리지 않는다** — `CLAUDE.md`의 「현재 상태」가 바뀔 때마다 위 2·4번을 그 자리에서
고쳐 쓴다(지난 세션 기록을 덧붙이지 않는다). 사실이 어긋나면 `CLAUDE.md`가 이긴다.

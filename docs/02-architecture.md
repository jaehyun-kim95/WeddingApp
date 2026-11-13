# 아키텍처

## 시스템 컨텍스트

두 사람(신부 본인 + 애인)이 각자 스마트폰에 설치한 **하나의 Expo 앱**이 **하나의 Supabase 프로젝트**
(Postgres + Realtime + Storage)를 공유 코드로 공유한다. 로그인 서버·계정 시스템은 없다 — 이 시스템의
경계 안에는 "커플 앱 ↔ Supabase"만 있고, 바깥(우리 것이 아닌 것)은 Supabase의 인프라 자체(DB 호스팅·
Realtime 서버·오브젝트 스토리지 운영)와 EAS(빌드·OTA 배포 인프라), 선택적으로 쓸 수 있는 외부
저장소(사진 원본을 Supabase Storage 용량 초과 시 돌릴 Google Drive 등, 3단계 데이터 설계에서 결정)다.

```
[신부 폰: Expo 앱]  ─┐
                      ├─ anon 키 + couple_id(공유 코드) ─→ [Supabase: Postgres/RLS + Realtime + Storage]
[애인 폰: Expo 앱]  ─┘
```

## 계층 · 모듈 구조

```
app/ (화면 — Expo Router 라우트)
  → features/*/hooks (TanStack Query — 서버 상태 캐싱/동기화/낙관적 갱신)
    → features/*/api (도메인 쿼리 함수 — 코어)
      → lib/rpc (공유 코드 주입 RPC 게이트웨이 래퍼)
        → lib/supabase (anon 클라이언트)
          → Supabase (Postgres, RLS로 couple_id 격리)
```

의존 방향은 위→아래 한 방향. **코어(`features/*/api`, `lib/`)는 React Native UI를 import하지 않는다**
— 화면이 훅을 통해 코어 함수를 호출하는 방향만 있고 역방향은 없다. 코어는 Supabase 호출만 알고
RN을 모른다(프레임워크 비의존 코어 원칙, `CLAUDE.md` §4). 모든 커플 데이터 접근은 `lib/rpc`를 거쳐
공유 코드가 주입되므로, 화면·훅은 `couple_id`를 직접 다루지 않는다(격리 로직 한 곳 집중).

## 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 앱 프레임워크 | Expo SDK 58 (React Native 0.88, React 19.3) + Expo Router + TypeScript strict | [ADR-0002](decisions/0002-tech-stack.md) |
| 백엔드 | Supabase (Postgres + Realtime + Storage), Auth 미사용 | [ADR-0002](decisions/0002-tech-stack.md) |
| 접근 통제 | `anon` 키 + RLS(공유 코드=`couple_id` 컬럼 필터), 로그인 개념 없음 | [ADR-0002](decisions/0002-tech-stack.md) |
| 서버 상태 관리 | TanStack Query v5 + `expo-sqlite`(로컬 캐시) | [ADR-0002](decisions/0002-tech-stack.md) |
| 엑셀 가져오기/내보내기 | SheetJS(xlsx) 0.20.3(CDN 설치) + `expo-file-system`·`expo-document-picker`·`expo-sharing`(base64 I/O, Expo Go 호환) | [ADR-0006](decisions/0006-excel-io-expo-modules.md) |
| 알림 | `expo-notifications` | [ADR-0002](decisions/0002-tech-stack.md) |
| 사진 업로드 | `expo-image-picker` | [ADR-0002](decisions/0002-tech-stack.md) |
| 비용·업체 데이터 경계 | 비용=지출 단일 원장, 업체=정보 전용 | [ADR-0001](decisions/0001-cost-vendor-boundary.md) |
| 배포 | EAS Build(내부 배포) + EAS Workflows(GitHub `main` push → 자동 `eas update`) | [ADR-0002](decisions/0002-tech-stack.md) |
| UI 디자인 시스템 | `DESIGN.md` + `design/system.css`(2단계 목업 — RN으로 이식 시 수치만 옮기고 CSS 자체는 재사용 안 함) | `DESIGN.md` |

## 디렉터리 구조

Expo scaffold(SDK 58, `src/` 레이아웃) 위에 얹는다. 트리 전체가 아니라 **"무엇이 어디에"** 규칙:

```
src/
  app/                      # Expo Router 라우트 — 파일 1개 = 화면 1개
    _layout.tsx             #   루트 Stack + Provider(Query·공유코드·테마) 주입
    (tabs)/                 #   하단 탭 그룹(NativeTabs)
      _layout.tsx           #     탭 정의: 홈·일정·체크·비용·더보기
      index.tsx             #     홈   schedule.tsx 일정   checklist.tsx 체크
      budget.tsx 비용        #     more.tsx 더보기 허브
    areas.tsx vendors.tsx guests.tsx gallery.tsx settings.tsx   # 탭 밖 push 화면
    onboarding.tsx          #   최초 진입: 공유 코드 입력/발급
  features/                 # 도메인(기능)별 묶음 — 화면 아닌 로직·전용 UI (계약은 features/README.md)
    <도메인>/               #   api.ts(셀렉터+쓰기 래퍼·코어) · hooks.ts(Query 훅) · types.ts · components/ · index.ts(배럴)
                            #   읽기=스냅샷 셀렉터(별도 조회 없음), 쓰기=테이블별 RPC(ADR-0003)
                            #   도메인: couple·checklist·schedule·budget·vendors·guests·gallery·areas·settings
                            #   couple=루트(공유 스냅샷 읽기 keys.ts·hooks.ts·use-realtime.ts). Phase 단위 점진 생성
  lib/                      # 인프라 — supabase.ts(anon 클라) · rpc.ts(공유코드 게이트웨이·모든 RPC의 유일 통로)
                            #          query-client.ts · share-code.ts(+ .web.ts) · share-code-format.ts
  providers/                # 전역 Context — share-code-provider.tsx(공유 코드 + Realtime 구동)
  components/ui/            # 공용 UI 프리미티브(디자인 시스템) — text·button·chip·meter·fab·list-row·switch·segmented·page-head (index.ts 배럴)
  constants/                # theme.ts — DESIGN.md 토큰(색·타이포·간격·반경)
  hooks/                    # 범용 훅 — use-app-fonts · use-reduced-motion · use-color-scheme
  types/                    # db.ts — 03 데이터 모델(테이블·enum) → TS 타입. CoupleSnapshot 단일 출처
assets/                     # 아이콘·이미지(scaffold 기본 → 교체)
```

**네이밍**(`CLAUDE.md` §5): 라우트 파일은 kebab-case(Expo Router 관례), 컴포넌트는 PascalCase 내보내기,
순수 로직 모듈(api·lib)은 kebab-case. 화면 로직은 `features/`에 두고 `app/`의 라우트 파일은 얇게 유지
(화면 조립만). 공용이면 `components/ui/`, 특정 도메인 전용이면 `features/<도메인>/components/`.
도메인 파일 계약·계층 규칙은 `src/features/README.md`가 실무 단일 출처.

**scaffold 예제 처리**: 템플릿 예제(`app/explore.tsx`, `components/animated-icon`·`app-tabs`·`hint-row`·
`web-badge`·`external-link`)는 실제 화면 구현 시 **교체·제거**한다. 재사용 프리미티브(`themed-text`·
`themed-view`·`ui/collapsible`)는 디자인 시스템에 맞춰 흡수한다.

## 횡단 관심사

| 관심사 | 담당 |
|---|---|
| 인증 | 없음(ADR-0002). 커플 테이블은 RLS 정책 없이 **RPC 게이트웨이로만 접근**(ADR-0003) — `lib/rpc`가 공유 코드를 주입해 격리. 전역 참조(area·seed_*·auspicious_day)만 anon 공개 읽기 |
| 설정 | 설정 화면(`settings.html` 목업)의 값들이 Supabase `settings` 류 테이블로 저장(세부는 `03`) |
| 로깅 | 미정 — Phase 0에서 필요 여부 판단(개인 2인 앱이라 원격 로깅 없이 Supabase 대시보드 조회로 충분할 가능성) |
| 에러 처리 | 미정 — Phase 0에서 TanStack Query의 재시도/에러 바운더리 정책 확정 |
| 국제화 | 없음 — 한국어 전용(`PRODUCT.md` Brand Commitments) |

## 비기능 요구 · 성능 예산

| 항목 | 예산 | 측정 방법 |
|---|---|---|
| 메뉴 탭 전환 | 100ms 이내 체감 | Expo Router 네이티브 전환 + 실기기 실측(개발 단계에서 확정) |
| 리스트 조회(캐시 적중) | 즉시(0ms 체감, 로컬 캐시 우선 표시) | TanStack Query `staleTime`/캐시 정책 + 실기기 실측 |
| 등록/삭제 낙관적 반영 | 입력 즉시 반영, 실패 시 롤백 | TanStack Query optimistic update + 실기기 실측 |
| OTA 업데이트 반영 | git push 후 앱 재실행 시 | EAS Update 채널 확인 |

수치는 2단계 설계 시점의 **목표치**다. 실측은 3단계 개발에서 `CLAUDE.md` §2(직접 실측 원칙)에 따라
실제 수치로 검증하고 "예산 대비 실측치"를 보고한다.

## 구현 함정

> 코드를 읽으면 아는 것은 쓰지 않는다. **읽어도 모르거나, 모르면 망가뜨릴** 것만 쓴다. 위 섹션들은
> **의도된 구조**, 여기는 **함정**이다 — 해당 영역(RN 컴포넌트·Supabase·비용 feature·화면 목업)을
> 만지기 전에 그 서브섹션만 읽는다(`CLAUDE.md` 「읽기」 표).

### RN 앱 코드(`src/`)

- **폰트 토큰은 정확한 웨이트 패밀리명을 가리킨다**(`theme.ts` `fonts`): RN은 웨이트별로 독립 패밀리를 등록해 숫자 `fontWeight` 합성이 불신뢰다. 새 웨이트 추가 시 `@expo-google-fonts/*` import·`use-app-fonts.ts`의 `useFonts` 맵·`theme.ts` `fonts`/`type` 3곳을 함께 고친다 — 문자열이 틀리면 **에러 없이 조용히 시스템 폰트로 폴백**한다.
- **토큰은 추가 전용, 레거시 공존 중**: 소문자 `colors`/`type`/`fonts`/`radius`/`spacing`/`layout`/`shadow`가 새 시스템. scaffold의 대문자 `Colors`/`Fonts`/`Spacing` 등은 `@deprecated`(곧 삭제될 데모 전용) — 새 코드는 쓰지 않는다.
- **다크모드 미지원**(사용자 확정): `use-color-scheme`이 항상 `'light'`. DESIGN.md에 다크 팔레트가 없으니 되살리려면 새 비주얼 월드 디자인이 필요해 "비주얼 방향 변경 금지"(`CLAUDE.md` 「현재 상태」)에 걸린다.
- **공용 컴포넌트 터치 타겟은 시각 크기가 아니라 히트 영역으로 ≥24px**: `Switch` 트랙은 38×22(시각)지만 `hitSlop:8`로 히트 54×38 확보. 시각 크기를 키우면 DESIGN.md 규격이 깨진다.
- **`Segmented` 썸 위치는 `onLayout` 실측 기반**: CSS `calc(50%)`가 아니라 트랙 폭을 실측해 계산한다 — 등폭 2~N 세그먼트 전제라 가변폭 라벨엔 안 맞는다.
- **`Fab` 래퍼는 화면 콘텐츠 영역에만 걸친다**(`fab.tsx`): Expo Router Tabs가 [콘텐츠][탭바]를 분할하므로 래퍼의 `bottom:0`이 이미 탭바 바로 위다. **`paddingBottom`에 `layout.tabBarHeight`를 더하면 이중으로 띄워진다**(실측: 탭바 간격 72px가 돼버린 적 있음) — 간격은 `paddingBottom` 값(`TAB_BAR_GAP=6`) 그 자체로만 준다. 배경은 `blush`가 아니라 **`blushInk`**(AA 대비).
- **탭 밖 push 화면(`areas`·`vendors`·`guests`·`gallery`·`settings`)은 위 전제가 깨진다**: 탭바가 없으니 `Fab`의 `bottom:0`이 시스템 네비게이션 바(안드로이드 제스처 바 등)와 겹친다. **`SafeAreaView`의 `edges={['bottom']}`만으로는 실제로 안 고쳐졌다**(실기기 실측, 하객 화면 — 이 조합에서 자동 padding이 Fab의 절대위치 기준 박스에 반영되지 않았다). 고친 방법: `Fab`에 `bottomInset?: number` prop을 추가해 호출부가 `useSafeAreaInsets().bottom`을 **직접** 넘긴다(`TabBar`가 이미 쓰는 명시적 훅 패턴과 동일) — `edges` 자동 처리에 기대지 않는다. 또한 이 화면들은 `_layout.tsx`의 루트 `Stack`이 `headerShown:true`로 **네이티브 헤더(제목+뒤로가기)를 이미 그려준다** — 화면 안에서 `PageHead`를 또 쓰면 제목이 중복되고 콘텐츠가 그만큼 아래로 밀린다(실측: 하객 화면에서 발견·수정). 네이티브 헤더가 top safe area도 이미 처리하므로 `SafeAreaView`에 `top`을 넣을 필요는 없다.
- **모션은 `use-reduced-motion`으로 감쇄**(`Segmented`·`Switch`·`Meter`·`TabBar`) — 새 애니메이션도 이 훅을 경유시킨다.
- **`Animated.Value`는 `useState(() => new Animated.Value(...))`로 지연 초기화**(`useRef(...).current` 아님): React Compiler 린트가 렌더 중 ref 접근을 에러로 잡는다 — 파일 단위 린트로는 숨어 있다가 `eslint src` 전체 실행에서만 걸린다.
- **날짜 선택은 네이티브 OS/브라우저 피커가 아니라 커스텀 `CalendarPicker`**(`calendar-picker.tsx`+순수 로직 `calendar-grid.ts`): 네이티브 피커는 "오늘" 표시를 디자인대로 커스터마이즈할 수 없어 폐기했다. 다른 달 칸은 완전히 빈 칸(흐리게 채우지 않기). 오늘=블러시-잉크 채움 원, 선택=블러시-잉크 2px 링 — 혼동하면 "선택했는데 오늘처럼 보인다".
- **일정 캘린더(`calendar-view.tsx`)의 날짜 마커는 "오늘 흰색 반전"을 적용하지 않는다**: DESIGN.md 규범은 오늘 칸 전체가 블러시로 채워질 때의 전제라, 숫자만 원 배지로 채우는 이 컴포넌트에선 마커가 항상 흰 배경 위에 그려져 반전하면 안 보인다(실측으로 발견, 한 번 반전했다가 고쳤다).
- **`DayCell` 마커 슬롯은 항상 3칸 고정 높이**(`MARKER_SLOT_H`/`MARKER_MAX`): 마커 수(0~3개)에 따라 셀 높이가 바뀌면 숫자 배지가 위아래로 밀린다(실사용 피드백 2026-11-09로 발견) — 빈 슬롯은 투명 처리.
- **`CalendarView`의 `readOnly`는 탭 자체를 막지 않는다**(홈 미니 캘린더용): 선택 링만 숨길 뿐 `onSelectDate`는 그대로 호출돼 "탭하면 일정 탭으로 이동"에 쓰인다. `disabled`로 막으면 이동이 깨진다.
- **탭바는 커스텀 컴포넌트가 렌더를 전담**(`tab-bar.tsx`, `_layout.tsx`의 `tabBar` prop): `Tabs`의 `screenOptions.tabBarStyle` 등은 **더 이상 적용되지 않는다** — 스타일링은 전부 `TabBar` 내부에서.

### Supabase 데이터 접근(`src/lib`·`supabase/`) — ADR-0003

- **커플 데이터는 RPC로만 접근한다** — 커플 테이블은 RLS 정책이 없어 `supabase.from()` 직접 호출은 **조용히 0행/차단**된다(에러 안 남). 유일 통로는 `@/lib/rpc`의 security-definer RPC. 전역 참조(`area`·`seed_*`·`auspicious_day`)만 직접 select 가능.
- **`gen_random_bytes`는 `extensions` 스키마**(`gen_share_code`): security-definer 함수에 `search_path = public, extensions`로 스키마 한정해야 한다(`public`만 주면 깨짐, 실제로 겪음).
- **커플 테이블/컬럼 추가 시 4곳을 함께 고친다** — 하나라도 빠지면 스냅샷 누락/실시간 미반영이 조용히 생긴다(기존 컬럼 추가는 트리거는 불필요, `to_jsonb`가 자동 포함):
  1. `get_couple_snapshot`의 `jsonb_build_object`
  2. 쓰기 RPC
  3. Broadcast 트리거
  4. `src/types/db.ts`의 `CoupleSnapshot`

### 금액 입력(`src/lib/money.ts`) — 비용·하객 공통

- **금액은 원(bigint) 저장, 표시·입력은 만원 단위, 100원(소수 둘째자리)까지 정밀**(사용자 결정 2026-11-10·2026-11-12): 입력 TextInput은 `sanitizeManInput`(숫자+소수점 1개만 통과)+`decimal-pad`, 제출은 `parseManInput`(문자열→원 한 번에) — `num()`+`manToWon()` 2단계로 직접 파싱하지 않는다. 비용·하객 **모든** 금액 입력 지점이 공통으로 쓴다 — 정밀도를 또 바꿀 일이 생기면 이 파일 하나만 고친다.
- **`formatMan`은 이미 "만"/"억" 접미사를 포함한 완성 문자열을 반환한다** — 호출부에서 `` `${formatMan(x)}만` `` 처럼 또 붙이면 "15억만"처럼 접미사가 중복된다(실측으로 발견·전체 수정, home-meters·guest-row·guest-side-section 등 4곳 — 새 금액 표시를 추가할 때 같은 실수를 반복하지 않는다).

### 비용 feature(`src/features/budget`) — Phase 1

- **분담 정산은 `payment.payer`(실납부)에서 나온다 — `expense_split`은 읽지 않는다**(ADR-0004). `expense_split`을 건드려도 효과 없다.
- **잔금·진행률 지표는 저장하지 않는 계산값**([ADR-0005](decisions/0005-budget-progress-metric.md)): 잔금=최종금액−Σ완료납부(`Math.max(0,…)`), `remaining`=약정−납부, 메인 진행률=`spentRate`만. payment 종류는 실제 낸 돈만(예약금/중도금/기타, `BALANCE`는 미사용) — 잔금을 payment로 입력하면 이중 집계된다.
- **`create_expense`는 옵션·납부를 jsonb로 받아 원자적 insert**(지출 추가 전용). **편집·납부토글·옵션/납부 추가삭제는 ExpenseDetail에서 granular RPC 즉시 호출** — 둘을 섞지 않는다.
- **`useAreaBreakdown(areas)`는 areas를 인자로 받는다**: `area`는 전역 참조라 스냅샷에 없어서다. 영역 배분은 지출 없는 영역도 포함해 6개를 항상 노출한다.
- **업체 인라인 생성 → 지출 생성은 2단계**(`budget.tsx submitForm`): '새 업체' 모드면 먼저 `createVendor`로 실제 id를 받은 뒤 `createExpense`에 넘긴다.
- **Realtime은 public Broadcast 채널 `couple:<share_code>`**: 클라이언트도 **반드시 `private:false`로 구독**해야 매칭된다.
- **영역 필터·지출 카드 펼침은 화면/카드 로컬 state다** — 스냅샷·캐시와 무관. 지출 카드 "편집" 진입은 헤더 탭(=펼침 토글)이 아니라 펼친 뒤 **"수정 →" 링크**다.

### 하객 feature(`src/features/guests`) — Phase 2

- **식대 단가(`meal_price`)는 하객 1명당 필드가 아니라 `couple` 테이블의 값 하나**다 — 영역 예산과 같은 "커플 전체 설정" 패턴(`update_meal_price` RPC). `guest` 행에 단가를 추가로 두지 않는다.
- **상단 요약(`summarizeGuests`)은 측 세그먼트(전체/신랑/신부)에만 반응하고 관계 필터·그룹 보기엔 반응하지 않는다**(사용자 요청 2026-11-12로 확정한 범위) — 화면에서 `summary`를 계산할 때 관계 필터가 걸린 목록을 넘기면 안 된다. 측별 소계(섹션 헤더)는 별도로 `selectSideSummary(allGuests, side)` — 관계 필터와 무관하게 항상 측 전체 기준이다.
- **참석 상태 변경은 폼이 아니라 행의 칩을 탭해 순환**(`ATTENDING→MAYBE→ABSENT→…`, `set_attend_status` RPC) — `update_guest`로 참석 상태만 바꾸는 별도 경로를 만들지 않는다.
- **엑셀 순수 변환(`guest-excel.ts`)과 RN 파일 I/O(`excel-io.ts`)는 분리돼 있다**(ADR-0006) — `guest-excel.ts`에 `xlsx`/`expo-*` import를 추가하지 않는다, 파일 I/O 쪽에서 `parseGuestRows`/`buildGuestAoa`만 가져다 쓴다.

### 업체 feature(`src/features/vendors`) — Phase 2

- **`CREATE OR REPLACE FUNCTION`으로 인자를 늘리면 "같은 함수 치환"이 아니라 "새 오버로드 생성"이다**
  (`0007_vendor_writes.sql`에서 실측 발견) — Postgres는 함수 identity를 (이름, 인자 타입 목록)으로
  식별한다. `create_vendor(text,uuid,text)`를 9-인자 default 버전으로 "확장"하려고 `CREATE OR
  REPLACE`만 쓰면, 타입 목록이 달라 기존 3-인자 함수가 안 지워지고 **두 함수가 동시에 존재**해
  3개 인자로만 호출하는 기존 호출부(비용 화면)가 "function is not unique" 모호성 에러로 깨진다.
  기존 함수를 더 많은 default 인자로 넓히려면 **먼저 옛 시그니처를 `DROP FUNCTION`** 한 뒤 새
  시그니처로 `CREATE`해야 한다 — 같은 실수를 반복하지 않으려면 RPC 인자를 늘리는 모든 마이그레이션
  에서 이 패턴을 쓴다.
- **업체 생성 경로가 2개다 — 기본값이 다르다**: `features/budget/api.ts`의 `createVendor`(3-인자,
  `rpc.createVendor` 경유, 비용 화면이 지출에 업체를 인라인 생성할 때 씀, SQL 쪽 default로
  `status='CONTRACTED'`가 적용됨)와 `features/vendors/api.ts`의 `createVendor`(9-인자,
  `rpc.createVendorFull` 경유, 업체 화면의 "업체 추가"가 씀, TS 쪽에서 `status ?? 'CANDIDATE'`로
  명시)는 **같은 `create_vendor` RPC를 호출하지만 상태 기본값이 다르다**. `create_vendor`의 default를
  바꾸면 두 호출부의 동작이 동시에 바뀐다는 걸 기억한다.
- **상태 전환(`CANDIDATE`↔`CONTRACTED`)은 모달의 명시적 버튼으로만 일어난다**(`vendor-form.tsx`) —
  전용 토글이 없다. "계약 확정"/"후보로 되돌리기"가 `update_vendor`를 호출해 `status`를 바꾼다.
  `status='CONTRACTED'`면 `contract_date not null`이 보통이지만 **DB 제약이 아니라 폼 레벨 가드**
  (`canContract = canSave && !!contractDate`)다 — 다른 경로로 `update_vendor`를 호출하면 이 불변식이
  강제되지 않는다.
- **업체 삭제는 연결된 지출이 있으면 DB가 거부한다**(`delete_vendor`, errcode `PT409`) —
  `expense.vendor_id`가 `on delete set null`이라 그냥 지우면 `title` 없는 연결 지출이
  `expense_direct_has_title` 체크 제약을 위반할 수 있어서다. 화면은 별도 사전 확인 없이 그냥
  삭제를 시도하고, 실패하면 기존 4개 feature와 동일한 `Alert` 패턴으로 사유가 뜬다.
- **"비용에서 보기"는 탭 밖 push 화면(`vendors.tsx`)에서 탭 화면(`budget.tsx`)으로 라우트
  파라미터(`?expenseId=`)를 넘기는, 이 저장소에서 처음 쓰인 네비게이션 패턴**이다 —
  `router.push({ pathname: '/budget', params: { expenseId } })` → `budget.tsx`가
  `useLocalSearchParams`로 받아 `useEffect`에서 `setDetailId(expenseId)`. 기존 탭→탭 이동(`index.tsx`
  의 바로가기 밴드 등)과 달리 스택 화면에서 탭 화면으로 진입하는 경로라 실기기 검증이 따로
  필요했다(2026-11-13 웹 프리뷰로 실측 통과). 모달을 닫아도(`setDetailId(null)`) URL의
  `expenseId`는 지워지지 않는다 — 비용 탭이 그 상태로 리마운트되면 모달이 다시 열릴 수 있는데,
  재진입 시 중복 오픈 안 됨까지 실측 확인(가드가 정상 동작).
- **영역 필터의 "빈 상태" 판단은 전체 데이터가 아니라 필터링 후 데이터 기준이어야 한다**(2026-11-13
  실기기 테스트로 재현) — `vendors.tsx`가 처음엔 `hasAny = groups.some(...)`로 **전체** 영역 기준
  빈 여부를 판단했다. 그 결과 다른 영역엔 업체가 있는데 선택한 영역만 비어 있으면, 빈 상태 안내
  문구 조건(`!hasAny`)엔 안 걸리면서 `visibleGroups.map`의 각 그룹도 `candidates`/`contracted`가
  0개라 `return null`이라, **안내 문구도 없이 완전히 빈 화면**이 됐다. `features/vendors/api.ts`의
  `hasVisibleVendors(groups, areaFilter)`로 교체해 고쳤다 — 영역 필터가 있는 다른 화면을 새로 만들
  때도 "전체엔 있지만 필터링하면 없다" 케이스를 빈 상태 조건에 반드시 포함시킨다.
- **Pressable(`accessibilityRole="button"`) 안에 또 다른 Pressable 버튼을 중첩하면 웹에서
  `<button>` 안에 `<button>`이 생겨 React 19 hydration 에러가 난다**(2026-11-13 브라우저 콘솔로
  재현) — `VendorContractPanel`이 카드 전체를 "수정" Pressable로 감싸고, 그 안에 "비용에서 보기"
  Pressable을 또 넣었던 게 원인. 네이티브에서는 터치 이벤트가 분리돼 문제없이 동작하지만, RN Web은
  `accessibilityRole="button"`을 실제 `<button>` 태그로 렌더링하므로 중첩이 그대로 유효하지 않은
  HTML이 된다. 카드를 `View`로 바꾸고 "수정"용 `Pressable`과 "비용에서 보기"용 `Pressable`을
  **형제**로 분리해 고쳤다 — 카드 안에 보조 액션 버튼을 또 넣어야 하면 바깥을 `Pressable`로
  감싸지 않는다.

### 화면 목업(`design/*.html`) — 2단계 산출물

- **탭바에서 "현재 화면" 탭도 `href`가 실제 자기 URL이어야 한다**(`href="#"` 금지): `more.html`·`areas.html`이 `href="#"`로 짰다가 Phase 2 감사에서 죽은 링크로 발견돼 고쳤다(`reports/phase-2.md`). 새 탭바는 기존 화면을 복사해서 쓴다.
- **FAB(`.fab`/`.fab-wrap`)는 화면 공유 컴포넌트**: `.fab-wrap`은 높이 0이라 안의 `.fab`은 `bottom` 기준(탭바높이+`--s4`)으로 띄워야 한다(`top` 기준이면 탭바를 덮는다). 배경은 `blush`가 아니라 **`blush-ink`**(AA 대비) — 원색은 저대비 검출에 걸린다.
- **`impeccable detect`의 `cream-palette`·`cramped-padding` 예외는 파일명 단위라 새 화면마다 재등록 필요**: 오프화이트 팔레트·탭바 밀착은 승인된 의도적 선택이지만 자동 적용되지 않는다(`.impeccable/config.json`에 새 파일도 등록).
- **그 외 화면별 CSS 구현 트릭**(관계 필터 `:has()` 특이도, 세그먼트 썸 형제 선택자 등)은 해당 `design/*.html` 파일 자체의 CSS에 남아 있다 — RN 구현 시 수치·레이아웃만 참고하고 CSS 트릭은 옮기지 않는다.

## 결정 기록 (ADR) 인덱스

| # | 제목 | 상태 |
|---|---|---|
| 0001 | [업체·비용 경계 — 비용 중심 통합](decisions/0001-cost-vendor-boundary.md) | 채택 |
| 0002 | [기술 스택 — Expo + Supabase, Auth 없는 RLS 공유](decisions/0002-tech-stack.md) | 채택 |
| 0003 | [RLS RPC 게이트웨이 — 커플 데이터 접근 격리](decisions/0003-rls-rpc-gateway.md) | 채택 |
| 0004 | [분담 정산 기준 — 실납부(payment.payer) 중심](decisions/0004-settlement-from-payments.md) | 채택 |
| 0005 | [비용 진행률·분담 표기 기준](decisions/0005-budget-progress-metric.md) | 채택 |
| 0006 | [엑셀 I/O 파일 접근 — Expo 공식 모듈로 교체](decisions/0006-excel-io-expo-modules.md) | 채택 |

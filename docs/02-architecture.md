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
UI(화면 컴포넌트, Expo Router 라우트)
  → 상태(TanStack Query 훅 — 서버 상태 캐싱/동기화)
    → 데이터 액세스(Supabase 클라이언트 호출을 감싼 함수들, 코어)
      → Supabase(anon 키, RLS로 couple_id 필터)
```

의존 방향은 위→아래 한 방향. **코어(데이터 액세스 함수)는 UI를 import하지 않는다** — 화면 컴포넌트가
코어 함수를 호출하는 방향만 있고 역방향은 없다. 코어는 Supabase 클라이언트 호출만 알고 React/RN을
모른다(프레임워크 비의존 코어 원칙, `CLAUDE.md` §4).

## 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 앱 프레임워크 | Expo SDK 58 (React Native 0.88, React 19.3) + Expo Router + TypeScript strict | [ADR-0002](decisions/0002-tech-stack.md) |
| 백엔드 | Supabase (Postgres + Realtime + Storage), Auth 미사용 | [ADR-0002](decisions/0002-tech-stack.md) |
| 접근 통제 | `anon` 키 + RLS(공유 코드=`couple_id` 컬럼 필터), 로그인 개념 없음 | [ADR-0002](decisions/0002-tech-stack.md) |
| 서버 상태 관리 | TanStack Query v5 + `expo-sqlite`(로컬 캐시) | [ADR-0002](decisions/0002-tech-stack.md) |
| 엑셀 가져오기/내보내기 | SheetJS(xlsx) 0.20.3(CDN 설치) + `react-native-blob-util` | [ADR-0002](decisions/0002-tech-stack.md) |
| 알림 | `expo-notifications` | [ADR-0002](decisions/0002-tech-stack.md) |
| 사진 업로드 | `expo-image-picker` | [ADR-0002](decisions/0002-tech-stack.md) |
| 비용·업체 데이터 경계 | 비용=지출 단일 원장, 업체=정보 전용 | [ADR-0001](decisions/0001-cost-vendor-boundary.md) |
| 배포 | EAS Build(내부 배포) + EAS Workflows(GitHub `main` push → 자동 `eas update`) | [ADR-0002](decisions/0002-tech-stack.md) |
| UI 디자인 시스템 | `DESIGN.md` + `design/system.css`(2단계 목업 — RN으로 이식 시 수치만 옮기고 CSS 자체는 재사용 안 함) | `DESIGN.md` |

## 디렉터리 구조

아직 코드가 없다(2단계는 정적 HTML 목업만 존재). 구조는 **Phase 0 착수 시** 확정해 이 절에
규칙(트리 전체가 아니라 "무엇이 어디에 들어가는가")만 적는다 — 지금 임의로 선언하지 않는다.

## 횡단 관심사

| 관심사 | 담당 |
|---|---|
| 인증 | 없음(ADR-0002) — `couple_id` 하나가 모든 테이블의 RLS 필터 기준 |
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

## 결정 기록 (ADR) 인덱스

| # | 제목 | 상태 |
|---|---|---|
| 0001 | [업체·비용 경계 — 비용 중심 통합](decisions/0001-cost-vendor-boundary.md) | 채택 |
| 0002 | [기술 스택 — Expo + Supabase, Auth 없는 RLS 공유](decisions/0002-tech-stack.md) | 채택 |

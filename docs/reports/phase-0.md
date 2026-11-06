# Phase 0 — 개발 기반 완료 보고

3단계(개발)의 첫 Phase. 앱이 기기에서 5개 탭을 오가고, 공유 코드로 Supabase에 접속해 데이터를
읽어오는 기반을 세웠다. 디자인 토큰·공용 컴포넌트가 `DESIGN.md`를 따른다.

## 개발 내용

| 영역 | 산출물 | 핵심 |
|---|---|---|
| 디자인 토큰 | `src/constants/theme.ts` | `DESIGN.md` 토큰(`colors`·`type`·`fonts`·`radius`·`spacing`·`layout`·`shadow`)으로 교체, **다크모드 제거**(단일 오프화이트 월드, 사용자 확정) |
| 폰트 로딩 | `@expo-google-fonts/*` + `use-app-fonts`→`_layout` | 웨이트별 독립 패밀리명 등록(RN 합성 비신뢰 회피) |
| 공용 컴포넌트 7종 | `src/components/ui/` | `Text`·`Chip`·`Meter`·`Fab`·`ListRow`·`Switch`·`Segmented`·`PageHead` |
| Supabase 백엔드 | `supabase/migrations/0001_init.sql`, `src/lib/` | 스키마 v1 적용, RLS **RPC 게이트웨이 격리**(ADR-0003) |
| 네비 뼈대 | `app/(tabs)/` 5탭 + 루트 Stack 서브화면 | areas·vendors·guests·gallery·settings + `onboarding` |
| 온보딩/게이트 | `providers/share-code-provider`, `use-couple-realtime` | 공유코드 게이트 + Realtime Broadcast 구독 |

scaffold가 남긴 데모·레거시 토큰·`themed-*`/`use-theme`는 전부 제거했다. 화면 본문은 플레이스홀더
(실구현은 Phase 1~3).

## 이슈

- **커플 테이블 anon 직접 접근이 조용히 0행/차단** — RLS 정책이 없어 `supabase.from('couple')`이
  에러 없이 빈 결과. security-definer RPC(`create_couple`·`get_couple_snapshot`)만 유일 통로로 삼음(ADR-0003).
- **`gen_random_bytes does not exist`** — pgcrypto가 `extensions` 스키마에 있어 `search_path=public`만으론
  깨짐. `extensions.gen_random_bytes(...)` 스키마 한정 + `search_path = public, extensions`로 해결.
- **expo-doctor 버전 드리프트 7건** — SDK 58 내 패치/마이너 불일치(선존). Phase 0 마무리 시 정렬.

## 트러블슈팅

- **Supabase 격리 검증을 실측 Node 스크립트로** — 공유코드별 스냅샷 분리·틀린 코드 PT401 거부·
  `couple` 직접접근 차단을 1회용 ESM 스크립트(루트에서 `@supabase/supabase-js`로 `.env` 키 사용)로
  직접 호출해 확인. "RLS가 막겠지" 추측이 아니라 실제 응답으로 검증.
- **웹 프리뷰 스크린샷이 Reanimated rAF로 타임아웃** → DOM/ref 기반 실측으로 우회(`javascript_tool`의
  `innerText`·`getBoundingClientRect`, `read_page` ref 클릭). 로직·좌표는 실측, 육안만 실행 환경으로.
- **`Segmented` 썸 위치** — CSS `calc(50%)` 대신 `onLayout` 실측 폭으로 등폭 계산 후 `Animated.translateX`.

## 사이드 이펙트 및 조치

- `expo install --fix`로 `package.json`·`package-lock.json` 변경(SDK 58 내 버전 범프, 메이저 변경 없음).
  정렬 후 `tsc` 0에러 재확인.
- `.env`는 gitignore, `.env.example`만 커밋. `EXPO_PUBLIC_*` 키만 사용(publishable/anon — RLS 보호 공개 키).
  `service_role`/secret은 클라이언트·`.env`에 넣지 않음.

## 검증 결과

- ✅ `npx tsc --noEmit` → 0에러 (레거시/scaffold 제거 후 실제 코드 기준, 버전 정렬 후 재확인)
- ✅ `npx expo-doctor` → **20/20 통과** (`expo install --fix`로 드리프트 7건 정렬)
- ✅ **공유코드 격리** — 그 커플 데이터만 반환, 틀린 코드 0건(실측 Node 쿼리)
- ✅ **온보딩 재접속** — 새 공유코드 발급→저장→재실행 자동 접속(웹 프리뷰 실측)
- ✅ **공용 컴포넌트 터치 타겟 ≥24×24px** — 리스트행 55·탭 48px, Switch 히트 54×38(DOM/좌표 실측)
- ✅ **실기기 확인** — Expo Go(터널 ngrok)로 QR 접속, 5개 탭 전환 + 더보기→서브화면 push/back 동작
  (사용자 실기기 테스트 통과, 2026-11-06)

## 미검증으로 남은 것

- **iOS 실기기** — Android Expo Go로 확인. iOS 독립 설치/빌드는 Phase 3 운영에서.
- **네이티브 모듈 빌드(EAS/독립 APK)** — 현재 Expo Go(개발 클라이언트)로만 구동. 실사용 배포 형태
  (APK 빌드)는 Phase 3 결정 사항.
- **`npm audit` moderate 5건** — 선존 경고. `--force` 없이는 미처리(브레이킹 위험).

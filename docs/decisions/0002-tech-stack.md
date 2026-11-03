# ADR-0002: 기술 스택 — Expo(React Native) + Supabase, Auth 없는 RLS 공유

- **상태**: 채택 (2026-11-03)
- **맥락**: 2단계(UI/UX 설계)가 끝나 3단계(개발) 착수 전 스택을 확정해야 했다
  (`PRODUCT.md` Stack은 "Undecided — deferred"로 명시, 임의 확정 금지). 제약은 셋:
  ① **웹을 거의 안 쓰고 앱 형식으로 사용** — `PRODUCT.md`의 비구속 후보(반응형 SPA)로는 부족,
  네이티브 체감이 필요했다. ② **둘이서만 쓰므로 배포·반영이 쉬워야** 한다 — 앱스토어 심사·CI 구축
  같은 무거운 배포 파이프라인은 과함. ③ **메뉴 이동·등록·삭제·조회가 느리지 않아야** 한다.
  추가로 ④ **비용을 0에 가깝게**, ⑤ **로그인 없음이 가장 본질적인 목표**(단순 "계정 생략"이 아니라
  코드 어디에도 "로그인" 개념 자체가 없어야 함 — `01-requirements.md`의 "담당자 지정은 단순 표기일
  뿐 접근 권한을 제한하지 않는다" 제약과 정확히 맞물린다)라는 두 요구가 대화 중 추가로 확정됐다.
- **결정**: **Expo(React Native) SDK 57 + Supabase**, Supabase **Auth는 쓰지 않고** `anon` 키 +
  RLS(공유 코드 컬럼 필터)만으로 접근 통제.
  - **앱 프레임워크**: Expo SDK 57.0.0 (React Native 0.86, React 19.2.3) + Expo Router(파일 기반
    라우팅, 탭바 5개+서브 화면 구조에 맞춤) + TypeScript strict.
  - **백엔드**: Supabase(Postgres + Realtime + Storage). `anon` 키로 클라이언트가 직접 접근하고,
    RLS 정책이 "요청에 포함된 공유 코드(=couple_id)가 일치하면 허용"만 검사한다. Supabase Auth의
    로그인·세션·익명 사용자 개념을 전혀 쓰지 않는다 — 공유 코드가 사실상 capability-URL의 열쇠 역할.
  - **상태 관리**: TanStack Query v5 — 로컬 캐시를 먼저 보여주고 백그라운드에서 갱신해 "느리지
    않은" 체감을 만든다. `expo-sqlite`를 세션/캐시 저장소로 병용.
  - **엑셀 I/O**: SheetJS(xlsx) 0.20.3 — **npm 레지스트리가 아니라 SheetJS CDN 타볼**로 설치해야
    최신 버전을 받는다(npm 레지스트리는 0.18.5에 고정된 알려진 버그). RN 환경에선 파일 읽기/쓰기에
    `react-native-blob-util`을 동반한다.
  - **알림/사진**: `expo-notifications`(납부일 알림), `expo-image-picker`(갤러리 업로드) — 둘 다
    Expo SDK 기본 포함 모듈이라 커스텀 네이티브 빌드 없이 동작한다.
  - **배포**: EAS Build(내부 배포 — 최초 설치용 APK/ad-hoc iOS, 앱스토어 불필요) + EAS Workflows로
    GitHub 연동(`main` push 시 자동 `eas update`) — 코드 변경은 push만으로 두 사람 폰에 OTA 반영,
    네이티브 변경(이번 범위에선 거의 발생 안 함)만 재설치 필요.
- **버린 안**:
  - **Flutter + Supabase** — 렌더링 성능은 비슷하거나 근소 우위지만, OTA 코드푸시가 EAS Update만큼
    턴키가 아니다(서드파티 Shorebird 필요) — "배포·반영이 쉬워야 한다" 요구에 못 미쳐 버렸다.
  - **Capacitor(웹뷰 래핑, 기존 `design/*.html` 재사용)** — 초기 작업량은 가장 적지만 웹뷰 기반이라
    메뉴 이동·리스트 반응이 네이티브보다 느리게 체감된다. "빠르게 반응하는 구조 선호"라는 명시적
    요구와 정면으로 어긋나 버렸다.
  - **Supabase 익명 로그인(Anonymous Auth) + couple_id** — 최초 제안안. Auth 세션·JWT가 내부적으로
    생기므로 "로그인 개념 자체가 코드 어디에도 없어야 한다"는 더 강한 요구에 못 미친다고 판단해,
    Auth를 아예 쓰지 않는 `anon` 키 + RLS 방식으로 단순화했다.
  - **Google/Firebase (비구속 후보였던 대안)** — Supabase의 무료 티어(DB 500MB·Storage 1GB·대역폭
    5GB/월)가 2인 사용 규모에 충분하고 Postgres+RLS로 "로그인 없는 공유 코드" 요구를 더 직접적으로
    풀 수 있어 Supabase를 택했다. Firebase는 별도로 비교하지 않았다(초기부터 후보에서 밀림).
- **결과**:
  - 코드 변경은 git push 한 번으로 양쪽 기기에 자동 반영된다(앱스토어 심사 없음). 최초 설치와
    드문 네이티브 변경 시에만 설치 링크를 다시 연다.
  - 전 구성 요소가 무료 플랜 범위에서 운용 가능하다. **유일한 비용 리스크는 갤러리 사진 원본이
    쌓여 Supabase Storage 무료 1GB를 넘는 경우** — 원본을 기기 로컬에만 두거나 Google Drive 같은
    외부 무료 저장소로 돌리는 설계로 완화할 수 있다(3단계 데이터 설계에서 결정, 지금 확정 안 함).
  - **새 제약**: RLS가 "공유 코드 일치"만 검사하므로 코드를 아는 사람은 누구나 전체 데이터에
    접근·수정할 수 있다 — 이미 `01-requirements.md`가 명시한 범위(로그인 없음, 외부 사용자 없음,
    접근 권한 제한 안 함)와 일치하는 의도된 트레이드오프이며, 사고가 아니다.
  - `docs/03-data-model.md` 초판에서 `couple_id` 컬럼과 그 위의 RLS 정책을 모든 테이블에
    일관되게 적용하는 패턴을 구체화해야 한다(다음 게이트).

**갱신 (2026-11-03, 버전 정정)**: 본문의 "SDK 57.0.0 (RN 0.86, React 19.2.3)"은 결정 시점의
context7 최신 정보였다. 실제 scaffold에서 `create-expo-app@latest`가 더 최신인 **SDK 58
(expo ~58.0.22, RN 0.88.1, React 19.3)** 을 설치해 그대로 채택했다 — 사용자의 "최신 스펙" 요구에
부합하고, 결정의 본질(Expo + Supabase + Auth 없는 RLS)은 불변이라 새 ADR 없이 버전만 정정한다.
살아있는 기준은 `docs/02-architecture.md` 「기술 스택」 표(= SDK 58).

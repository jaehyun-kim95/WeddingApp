# Phase 3 작업 보고 — 백업 내보내기/가져오기 + 납부일 알림

Phase 3(재조합·운영)의 4개 작업(모아보기·설정·표준 시드/백업·알림) 중 모아보기+설정 핵심은
[phase-3.md](phase-3.md)에서 이미 완료했다. 이번엔 그때 다음 세션으로 넘긴 4개 중 **백업
내보내기/가져오기**와 **납부일 알림** 두 개를 진행했다. 표준 시드 불러오기(콘텐츠 작성 부담)와
길일 표시(전통 역법 데이터 확보 미결정)는 여전히 범위 밖이다(사용자 결정 2026-11-17).

## 개발 내용

**백업 (`src/features/backup/`)** — 하객 엑셀 I/O 3계층 패턴(ADR-0006)을 미러링. 코어
`backup-format.ts`(순수 — `buildBackup`/`parseBackup`/`migrateBackup`/`countRows`)가 백업 파일
포맷(`schema_version` 정수, DB 스키마 버전 `db_schema`는 표시용으로 분리)을 다루고, 글루
`backup-io.ts`(expo-document-picker/expo-file-system(legacy, UTF8)/expo-sharing)가 실제 파일
I/O를 맡는다. `area_id`를 가진 모든 행(checklist_item·schedule_event·vendor·expense·area_budget·
photo)에는 내보내기 시 `area_code`를 동봉해, 복원 시 환경이 달라도 `area.code`로 안전하게
재해소한다(ADR-0009). 복원은 **전체 교체**라 `useRestoreBackup`에 낙관적 패치가 없고, 서버가
돌려준 전체 스냅샷을 `onSuccess`에서 그대로 캐시에 반영한다. `backup-import-preview.tsx`가
테이블별 건수·파괴적 경고("기존 데이터를 모두 덮어씁니다")·버전 변환 안내를 보여주고 명시적
확인을 받는다. 설정 화면에 "데이터" Group(백업 내보내기/가져오기 2행)을 추가했다 — "표준 시드
불러오기" 행은 콘텐츠 미작성이라 넣지 않았다.

**새 RPC** (`supabase/migrations/0010_backup_restore.sql`, 사용자가 SQL Editor에서 직접 실행 필요):
`restore_couple_backup(p_share_code, p_bundle)` — 단일 트랜잭션으로 couple 본체 덮어쓰기(id·
share_code·created_at 유지) → 자식 11개 테이블 FK 역순 삭제 → old→new UUID 매핑(vendor·expense
2레벨, temp table) 후 FK 정순 재삽입(area_code→area.id 재해소) → 갱신된 `get_couple_snapshot`
반환. `import_guests`(0006, 단일 테이블 벌크 insert) 선례를 11개 테이블로 확장한 형태다.

**ADR-0009**(백업 복원=전체 교체) 신규 작성 — 되돌리기 비싼 선택(기존 데이터 영구 삭제)이라
ADR 트리거에 해당. 버린 안(병합)과 그 이유(매칭 키 없음→중복 누적·정산 오염)를 남겼다.

**알림 (`src/features/notifications/`)** — `expo-notifications ~58.1.9` 신규 설치. 코어
`payment-reminders.ts`(순수 — `computePaymentReminders`가 미납·`due_date` 있는 payment를
`daysBefore=[3,0]`·`hour=9`로 발화 계획으로 변환, 과거 시각 제외)와 글루
`notifications-io.ts`(expo-notifications/expo-device — Android 채널 선행→권한 확인/요청→
포그라운드 핸들러, `syncPaymentReminders`는 **전량 재동기화**: `cancelAllScheduledNotificationsAsync`
후 전부 재예약)로 분리. `usePaymentReminderSync`가 스냅샷(payments+notify_payments) 변경과
`AppState` 포그라운드 전환 시 재동기화하며, 자체 가드(공유코드 ready)를 둬 `_layout.tsx`
`RootNav`에서 조건 없이 호출한다. `couple.notify_payments` 토글 UI/저장은 이미 있던 것을 그대로
썼다(새 컬럼·RPC 불필요 — `get_couple_snapshot`이 이미 포함).

## 이슈

없음 — 두 작업 모두 구현 중 설계를 바꿔야 했던 막힌 지점은 없었다(사전 설계 단계에서 restore
시맨틱·알림 발화 시점을 먼저 확정해 둔 덕분).

## 트러블슈팅

- **알림 아이콘 자산 부재** — `app.json`의 `expo-notifications` plugin에 커스텀 `icon` 옵션을
  넣으려 했으나 `assets/images/notification-icon.png`가 존재하지 않아, 없는 경로를 넣으면 빌드가
  깨질 위험이 있었다. `color`만 설정하고 `icon`은 뺐다 — 아이콘을 추가하려면 자산 파일부터
  만들어야 한다(`02` 「구현 함정 — 알림 feature」에 메모).
- **eslint 3건**: ①`AppState` ref 갱신을 렌더 중이 아니라 `useEffect`로 옮김(커밋 후 최신값 보장)
  ②`Notifications.AndroidImportance`가 `export *` 재노출이라 네임스페이스 접근이
  `import/namespace`에 안 잡혀 named import로 전환 ③글루 테스트의 `import/first` 경고를 import를
  위로, `jest.mock`을 아래로 옮겨 해소.
- **플랜 문서의 "스냅샷 함수는 0004에서 재작성" 기술이 실제 코드와 약간 달랐음** — 코드를 직접
  읽어 `get_couple_snapshot`은 0001 초판, 0004가 `area_budgets` 슬라이스 추가로 재작성한 것임을
  확인하고 현재 최종 스냅샷 키 순서(couple…payments, area_budgets, guests, photos)에 맞춰
  `0010_backup_restore.sql`을 작성했다 — 문서보다 코드를 신뢰한다는 Part B 공통 규칙대로 처리.
- **일부 Android 기기(Expo Go) 실기기 테스트 중 발견 — `setNotificationChannelAsync`가 네이티브
  `NullPointerException`으로 거부돼 캐치 안 된 Promise 거부로 에러 화면까지 떴다**(사용자 리포트,
  스크린샷 첨부). config plugin이 적용 안 된 Expo Go 환경의 알려진 제약(Android 전체 경로 미검증)이
  "조용한 미동작"이 아니라 앱을 막는 수준으로 드러난 사례 — `ensureNotificationSetup`의 채널 생성
  호출과 `usePaymentReminderSync`의 `sync()` 전체를 각각 try/catch로 감싸 이중으로 막고, 회귀
  테스트(`notifications-io.android.test.ts`, Platform.OS='android' 모킹)를 추가해 재발을 막았다.
  Android에서 알림 자체가 실제로 동작하는지는 여전히 미검증이지만 더 이상 화면을 막지 않는다.
- **백업 가져오기 실기기 테스트 중 발견 — Android Expo Go에서 다운받은 JSON 파일을 고르면
  `ExponentFileSystem.readAsStringAsync`가 `"isn't readable"` IOException으로 거부**(사용자
  리포트, 스크린샷 첨부). Expo 소스코드(`expo-document-picker`/`expo-file-system` Android 네이티브
  모듈)를 직접 확인해 근본 원인을 찾았다: `expo-document-picker`가 선택한 파일 복사본을 host 앱의
  원시 `context.cacheDir`에 쓰는데, `expo-file-system`(legacy)의 읽기 권한 검사(`permissionsForPath`)는
  Expo Go의 실험별 샌드박스 경로(`appContext.cacheDirectory`, 즉 `cache/ExperienceData/<id>/...`)만
  허용한다 — 둘이 다른 디렉터리 기준이라 Expo Go에서만 어긋나고(개발빌드는 두 경로가 같아 재현 안
  됨), 방금 복사된 파일을 "읽을 수 없다"고 거부한다. 수정은 그 권한 게이트를 타지 않는
  `fetch(uri)`로 읽기를 바꾸는 것 — `backup-io.ts`(텍스트, `.text()`)와 **같은 패턴이라 아직
  신고되지 않았던 하객 엑셀 가져오기(`excel-io.ts`)도 함께 고쳤다**(바이너리, `.arrayBuffer()` →
  `XLSX.read({type:'array'})`로 base64 왕복도 제거). 둘 다 회귀 테스트 추가(진짜 xlsx 바이너리로
  왕복 검증, `backup-io.test.ts`·`excel-io.test.ts`).

## 사이드 이펙트 및 조치

- `src/lib/rpc.ts`에 `restoreBackup` 추가(`import type { BackupData }` — type-only라 런타임
  순환 없음), `src/app/settings.tsx`에 "데이터" Group 추가(상단 주석 갱신).
- `src/app/_layout.tsx`의 `RootNav`에 `usePaymentReminderSync()` 호출 추가. `package.json`/
  `app.json`에 `expo-notifications` 반영.
- 두 작업은 파일 충돌 없이 병렬 진행(백업=rpc.ts/settings.tsx/backup 디렉터리/migration 0010,
  알림=notifications 디렉터리/_layout.tsx/package.json/app.json) — 병합 후 재검증에서도 충돌 없음.

## 검증 결과

- [x] `npx tsc --noEmit` 0에러
- [x] `npx jest` 25 suites / **295개 전통과**(신규 51개 — 백업 코어 24개 + 알림 코어 16개 +
      알림 글루 4개 + Android 채널 실패 회귀 2개 + 백업/엑셀 fetch 읽기 회귀 5개)
- [x] `npx expo lint`(프로젝트 표준 린트 명령, `src/`만 대상) 0에러/0경고 — `npx eslint .`로
      직접 돌리면 저장소 전체(빌드 산출물·설정 파일 등 비소스 포함)를 긁어 다수 오탐이 나니
      **반드시 `npm run lint`(`expo lint`)를 쓴다**(새로 발견, `CLAUDE.md` 「빌드 & 실행」에 반영).
- [x] 백업 코어 왕복 무손실·버전 게이팅(미래/구버전/app 불일치)·병리 입력(빈/깨진/부분 번들) 단위
      테스트 통과
- [x] 알림 코어 경계값(과거/미래 due_date, 정각 동일 케이스)·`daysBefore` 조합·id 유일성 단위
      테스트 통과
- [ ] **`restore_couple_backup` 실 DB 동작 미검증** — 이 저장소는 Supabase CLI 링크가 없어
      `0010_backup_restore.sql`은 자동 적용되지 않는다. **SQL Editor에서 1회 수동 실행 필요.**
      실행 후 복원 행수 일치·2회 복원 멱등(UUID 제외 동일)·expense↔option/split/payment 관계
      보존을 실측해야 한다.
- [ ] 백업 가져오기 전체 e2e(DocumentPicker→복원→Realtime 수렴)·내보내기 공유 시트는 실기기
      미검증(순수 코어·파싱만 자동화 검증됨)
- [ ] Expo Go(iOS) 실기기 알림 실제 발화·토글 on/off 예약/취소·due_date 변경 재동기화 미검증
- [ ] **Android 알림 전체 경로(채널·`POST_NOTIFICATIONS` 권한·config plugin 아이콘)는 범위 밖**
      — dev build 필요, 사용자 결정으로 이번 세션엔 다루지 않음

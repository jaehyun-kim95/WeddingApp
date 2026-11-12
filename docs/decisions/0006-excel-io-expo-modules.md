# ADR-0006: 엑셀 I/O 파일 접근 — Expo 공식 모듈로 교체(blob-util 대체)

- **상태**: 채택 (2026-11-12)
- **맥락**: Phase 2 하객 슬라이스의 엑셀 가져오기/내보내기 구현(파일 선택·읽기·쓰기·공유) 착수 직전,
  [ADR-0002](0002-tech-stack.md)가 지정한 `react-native-blob-util`이 **Expo Go에서 동작하지 않음**이
  확인됐다. blob-util은 autolinking이 필요한 서드파티 **네이티브 모듈**이라 Expo Go(미리 빌드된 런타임)에
  포함돼 있지 않다. 현재 개발 흐름은 Expo Go + 터널 QR로 실기기에 붙는 방식이고([phase-0 보고서](../reports/phase-0.md)),
  EAS 커스텀 dev build는 Phase 4(배포)에서야 다룬다. 즉 blob-util을 지금 도입하면 Phase 4 배포 작업을
  앞당겨 dev build 체인을 먼저 세워야 하는 선행 비용이 생긴다. ADR-0002는 2단계 스택 확정 시점에
  "RN 환경에선 파일 읽기/쓰기에 blob-util을 동반"이라고만 적었고 Expo Go 제약은 고려되지 않았다.
- **결정**: 엑셀 파일 접근을 **Expo SDK 공식 모듈 조합**으로 구현한다. SheetJS(xlsx) 선택 자체는 불변.
  - **파일 읽기/쓰기**: `expo-file-system`(base64 문자열로 읽고 쓴다). SheetJS는
    `XLSX.read(base64, { type: 'base64' })` / `XLSX.write(wb, { type: 'base64' })`로 base64를 직접 다룬다.
  - **가져오기 파일 선택**: `expo-document-picker`(.xlsx 선택).
  - **내보내기 파일 공유**: `expo-sharing`(시스템 공유 시트로 저장/전송).
  - **파싱 라이브러리**: SheetJS(xlsx) 0.20.3 — ADR-0002대로 **SheetJS CDN 타볼** 설치(npm 레지스트리 금지).
  - 순수 변환 로직(aoa↔하객 행 정규화)은 라이브러리·파일 I/O와 분리된 순수 모듈(`features/guests/guest-excel.ts`)에
    두어 테스트 가능하게 한다 — 02 「프레임워크 비의존 코어」 원칙.
- **버린 안**:
  - **`react-native-blob-util` 유지(ADR-0002 원안)** — Expo Go 비호환이라 EAS 커스텀 dev build를 Phase 2에
    선(先)구축해야 한다. 2인 실사용·Expo Go 중심 개발 흐름에 과한 선행 비용이라 버렸다. Expo 공식 모듈은
    Expo Go에서 바로 동작하고 dev build·배포에서도 그대로 쓰여 전환 비용이 없다.
  - **엑셀 I/O를 별도 후속 슬라이스로 미룸** — 하객의 핵심 성공 기준이 "엑셀로 가져오고 내보낸다"(01)라
    같은 슬라이스에서 끝내는 편이 응집도가 높다고 보아 미루지 않았다.
- **결과**:
  - Expo Go 개발 흐름이 유지된다 — Phase 2에서 dev build 선행 불필요.
  - ADR-0002의 "RN 파일 I/O = blob-util" 항목은 **이 ADR로 대체**된다(ADR-0002에 대체 표시). 스택의 단일
    출처인 `docs/02-architecture.md` 「기술 스택」 표의 엑셀 I/O 행도 Expo 모듈 조합으로 갱신한다.
  - 새 Expo 의존성 3종(`expo-file-system`·`expo-document-picker`·`expo-sharing`)은 모두 Expo SDK 모듈이라
    `npx expo install`로 SDK 58에 맞춰 설치되고, Phase 4 EAS 빌드에서도 추가 네이티브 설정 없이 동작한다.

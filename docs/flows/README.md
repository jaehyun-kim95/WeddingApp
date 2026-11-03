# 프로세스 흐름도 (산출물)

빌드를 이끄는 핵심 기능 흐름. 각 흐름은 **소스(`.mmd`, mermaid)** + **렌더 이미지(`.svg`)** 두 형태로
관리한다(소스가 단일 출처, SVG는 소스에서 `mermaid-cli`로 생성 — 아래 「갱신 방법」). GitHub·VS Code에서
`.mmd`/아래 코드블록이 다이어그램으로 바로 렌더된다.

Phase 계획·완료 기준은 [`../04-dev-plan.md`](../04-dev-plan.md), 데이터 구조는 [`../db/`](../db/) 참조.

| # | 흐름 | 소스 | 이미지 | 무엇을 보이나 |
|---|---|---|---|---|
| ① | 최초 실행 — 공유 코드 온보딩 | [01-onboarding.mmd](01-onboarding.mmd) | [svg](01-onboarding.svg) | 앱 실행 → 코드 유무 → 발급/참여 → 홈 |
| ② | 등록/삭제 — 낙관적 갱신 | [02-optimistic-crud.mmd](02-optimistic-crud.mmd) | [svg](02-optimistic-crud.svg) | 캐시 즉시 반영 → RPC → 성공 확정/롤백 |
| ③ | 실시간 동기화 | [03-realtime-sync.mmd](03-realtime-sync.mmd) | [svg](03-realtime-sync.svg) | 상대 변경 → Realtime → 캐시 무효화 → 갱신 |
| ④ | 표준 시드 불러오기 | [04-seed-load.mmd](04-seed-load.mmd) | [svg](04-seed-load.svg) | seed 조회 → 날짜 계산 → 커플 데이터 복사(멱등) |
| ⑤ | 비용 집계 | [05-budget-aggregate.mmd](05-budget-aggregate.mmd) | [svg](05-budget-aggregate.svg) | 기본+옵션→최종, 납부→실지출, 분담 정산 |
| ⑥ | 배포 — push → OTA | [06-deploy-ota.mmd](06-deploy-ota.mmd) | [svg](06-deploy-ota.svg) | git push → EAS Workflow → OTA → 반영 |

## 흐름 (렌더)

### ① 최초 실행 — 공유 코드 온보딩
![온보딩](01-onboarding.svg)

### ② 등록/삭제 — 낙관적 갱신
![낙관적 갱신](02-optimistic-crud.svg)

### ③ 실시간 동기화
![실시간 동기화](03-realtime-sync.svg)

### ④ 표준 시드 불러오기
![시드 불러오기](04-seed-load.svg)

### ⑤ 비용 집계
![비용 집계](05-budget-aggregate.svg)

### ⑥ 배포 — push → OTA
![배포](06-deploy-ota.svg)

## 갱신 방법

`.mmd`를 고친 뒤 SVG를 다시 생성한다(소스가 단일 출처):

```bash
cd docs/flows
npx -y @mermaid-js/mermaid-cli -i <이름>.mmd -o <이름>.svg -b transparent
```

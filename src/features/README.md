# features/ — 도메인별 묶음

화면이 아니라 **도메인(기능)별 로직·전용 UI**를 모은다. 라우트(`app/`)는 얇게 유지하고 실제 로직은
여기 둔다. 규범은 `docs/02-architecture.md` 「계층·모듈 구조」·「디렉터리 구조」 — 이 README는 그걸
파일 단위로 풀어 쓴 실무 계약이다.

## 계층 규칙 (단방향 — 역방향 import 금지)

```
app/  →  features/<도메인>/hooks  →  features/<도메인>/api  →  lib/rpc  →  lib/supabase  →  Supabase
```

- **코어는 RN/expo UI를 import하지 않는다**: `api.ts`와 `lib/*`는 순수 로직(프레임워크 비의존,
  CLAUDE.md §4). `react`/`react-native`/`expo-*` import는 `hooks.ts`·`components/`·`app/`에서만.
- **커플 데이터는 `lib/rpc` 경유만**: 테이블 직접 `from()` 금지(ADR-0003). 모든 `supabase.rpc()`는 lib/rpc.
- **읽기는 단일 스냅샷**: `get_couple_snapshot` 하나가 전 테이블을 JSON으로 반환한다. 그래서 각 도메인
  읽기는 **별도 조회가 아니라 스냅샷 셀렉터**다. 쓰기만 테이블별 RPC.

## 도메인별 파일 계약

| 파일 | 역할 | RN import |
|---|---|---|
| `api.ts` | 코어(순수). ① 셀렉터 `select<X>(snapshot) → 슬라이스/파생값` ② 쓰기 함수(lib/rpc 호출) | ❌ |
| `hooks.ts` | TanStack Query 훅. 읽기 `use<X>()` = `useCoupleSnapshot(select…)`, 쓰기 `use<Mutation>()` = 스냅샷 캐시 낙관적 패치 | ✅ |
| `components/` | 도메인 전용 UI(PascalCase). 공용 프리미티브는 `@/components/ui` 재사용 | ✅ |
| `types.ts` | `types/db.ts` 행 타입을 넘어서는 뷰/파생 타입만 | — |
| `index.ts` | 배럴 — 화면은 `@/features/<도메인>`로 공개 훅·컴포넌트를 import | — |

`components/`는 첫 컴포넌트가 생길 때 만든다(빈 디렉터리는 git이 추적 못 함).

## couple = 루트 도메인

모든 읽기의 기반. `useCoupleSnapshot(select)`가 공유 코드로 스냅샷을 한 번 조회·캐시하고, 다른 도메인
훅은 그 위에 `select`로 자기 슬라이스를 얹는다. 쿼리 키는 `couple/keys.ts`(`coupleKeys.snapshot`)가
단일 출처 — Realtime 무효화(`use-realtime.ts`)도 같은 키를 쓴다.

> ⚠️ `providers/share-code-provider`는 **순환을 피해** couple 배럴이 아니라 `@/features/couple/use-realtime`를
> 직접 import한다(배럴→`hooks.ts`→provider 순환 방지). 새 도메인엔 이 함정이 없다 — 배럴을 쓰면 된다.

## 새 도메인 추가 절차 (Phase 2~3)

1. `features/<도메인>/`에 `api.ts`(셀렉터) + `hooks.ts`(읽기 훅) + `index.ts`. 필요 시 `types.ts`·`components/`.
2. 쓰기가 필요하면 새 migration(`supabase/migrations/000N_*.sql`)에 쓰기 RPC를 추가하고 **스냅샷 함수·
   쓰기 RPC·Broadcast 트리거 3곳을 함께** 고친다(CLAUDE.md 「아키텍처」 함정). `lib/rpc`에 래퍼.
3. 화면(`app/`)은 `@/features/<도메인>`에서 훅을 가져와 조립만 한다.

현재 생성된 도메인: **couple · checklist · schedule · budget**(Phase 1). 나머지(vendors · guests · gallery ·
areas · settings)는 해당 Phase에서 생성.

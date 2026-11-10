# Phase 1 세 번째 슬라이스 — 비용 화면 (설계 스펙)

작성일: 2026-11-10 · 상태: 승인됨(사용자) · 범위: Phase 1의 세 번째 세로 슬라이스

## 왜 이 문서인가 (Context)

체크리스트·일정 슬라이스가 쓰기 RPC·낙관적 캐시·jest 테스트·공용 컴포넌트 패턴을 확립했다.
이번 슬라이스는 **같은 패턴을 비용(budget) 화면에 재적용**한다. 비용은 ADR-0001에 따라 **지출의
단일 원장** — 업체별 기본 견적 + 옵션(추가금) → 최종금액, 예산 대비 소비율, 분담 정산을 통합
관리한다. `src/features/budget/`에는 읽기 셀렉터 일부만 있고(`selectExpensesWithTotals` 등), 쓰기
RPC·낙관적 캐시·집계 셀렉터·컴포넌트·화면은 미구현이다(`budget.tsx`는 PlaceholderScreen 스텁).

**이전 두 슬라이스와 다른 점**: 비용은 커플 **스키마를 확장**한다(예산 저장소가 데이터 모델에
없었음). 따라서 체크리스트·일정과 달리 "쓰기 RPC만 추가"가 아니라 테이블/컬럼 추가 → 스냅샷 함수·
트리거·TS 타입까지 함께 손대는 슬라이스다.

## 결정된 전제 (브레인스토밍 2026-11-10 — 바뀌면 이 문서부터 고친다)

1. **예산 저장** — `couple.total_budget`(전체 예산) + 새 `area_budget` 테이블(영역별 예산). 목업의
   영역별 '예산 1,500만' 미터·초과(테라코타) 경고를 전부 실데이터로 구동.
2. **분담 정산 = 실제 납부액 기준**(ADR-0004) — `payment`에 `payer` 컬럼 추가, 분담 = Σ(납부완료
   payment.amount) by payer. 기존 `expense_split`은 Phase 1 비용 화면에서 **미사용**(스키마는 유지).
3. **업체 연결 = 비용 화면에서 인라인 생성/선택** — vendors 화면 미구현이므로 지출 추가 시 기존
   업체 선택 또는 이름으로 신규 업체 생성(최소 필드: 영역·이름, status 기본 CONTRACTED).
4. **입력 흐름 = 단일 폼 섹션 분할** — 지출 추가 폼 하나에 기본(영역·업체·기본금액) + 옵션(동적 행)
   + 납부(예약금/잔금·금액·납부자·납부일·완료) 섹션을 담아 **원자적으로** 저장(CLAUDE.md 「전부-
   아니면-전무」).
5. **예산 입력 = 비용 화면 인라인 탭 수정** — 상단 전체 예산·각 영역 예산 숫자를 탭하면 그 자리에서
   숫자 편집·저장(별도 설정 화면 불필요).
6. **UI는 승인된 목업 이식** — `design/budget.html` 구조·수치를 RN으로. DESIGN.md 상속, 새 비주얼
   월드 금지. 공용 프리미티브(`Meter`·`Chip`·`Fab`·`CalendarPicker`·폼 패턴) 재사용.
7. **읽기 = 단일 스냅샷 셀렉터**(ADR-0003) — `useCoupleSnapshot` 위에 얹는다.

## 집계 정의 (목업 수치와 일치)

- **약정** = Σ(지출 최종금액) = Σ(base_amount + Σ option.amount). 목업 2,320만.
- **실지출** = Σ(납부완료 payment.amount). 목업 2,140만.
- **잔여** = total_budget − 약정. 목업 2,680만.
- **소비율 미터** = 약정 / total_budget. 목업 46%(=2320/5000). 실지출은 미터 옆 병기.
- **영역 소계** = 영역 내 Σ 최종금액. **초과** = 소계 > area_budget(테라코타).
- **분담 정산** = payer별 Σ(납부완료 payment.amount). 미터 percent = payer액 / 총납부. 미터는
  중립 웜그레이(One-Axis Color Rule — 색은 예산 상태에만).

## 산출물

### ① 마이그레이션 — `supabase/migrations/0004_budget_writes.sql`

**스키마 변경**: `couple.total_budget bigint not null default 0`, `payment.payer payer`(nullable),
`area_budget`(couple_id·area_id·amount, unique(couple_id,area_id)) + RLS enable(정책 없음=anon 차단)
+ `trg_bc_area_budget` broadcast 트리거. `get_couple_snapshot` `create or replace`로 `area_budgets`
슬라이스 추가(total_budget·payer는 to_jsonb 자동 포함).

**쓰기 RPC**(전부 security-definer·`p_share_code` 해소·PT401/PT404·`grant ... to anon`):

| RPC | 인자 | 동작 |
|---|---|---|
| `create_expense` | `p_share_code, p_area_id, p_vendor_id, p_title, p_base_amount, p_options jsonb, p_payments jsonb` | 한 트랜잭션에서 expense + 옵션들 + 납부들 insert, expense 행 반환 |
| `update_expense` | `p_share_code, p_id, p_title, p_base_amount` | 영역·업체 고정(체크리스트 관례) |
| `delete_expense` | `p_share_code, p_id` | FK cascade로 옵션·분담·납부 동반 삭제 |
| `create_vendor` | `p_share_code, p_area_id, p_name` | 인라인 최소 생성, status=CONTRACTED·role null, 행 반환 |
| `add_expense_option` / `delete_expense_option` | `p_share_code, p_expense_id, p_name, p_amount` / `p_id` | 기존 지출 옵션 추가/삭제 |
| `add_payment` / `update_payment` / `delete_payment` | `p_share_code, p_expense_id, p_kind, p_amount, p_due_date, p_payer, p_is_paid` / `p_id, ...` / `p_id` | 납부 CRUD |
| `toggle_payment_paid` | `p_share_code, p_id, p_is_paid` | is_paid + paid_at(체크리스트 토글 패턴) |
| `set_area_budget` | `p_share_code, p_area_id, p_amount` | upsert(on conflict couple_id,area_id) |
| `update_total_budget` | `p_share_code, p_amount` | couple.total_budget 갱신 |

### ② TS 타입 — `src/types/db.ts`

`Couple.total_budget: number`, `Payment.payer: Payer | null`, `AreaBudget` 신설, `CoupleSnapshot.
area_budgets: AreaBudget[]`.

### ③ RPC 래퍼 — `src/lib/rpc.ts`

①의 RPC별 타입드 래퍼(ADR-0003 — `supabase.rpc`는 이 파일에만, PT401→`ShareCodeInvalidError`).

### ④ 도메인 로직 — `src/features/budget/`

- `types.ts`: 기존 `ExpenseWithTotal` 유지 + `BudgetSummary`·`PayerSettlement`·`AreaBreakdown`·
  `VendorGroup` 뷰 타입.
- `api.ts`(순수 코어): 쓰기 위임 함수 + Input 타입, 읽기 셀렉터 — `selectBudgetSummary`·
  `selectSettlementByPayer`(null payer 제외)·`selectAreaBreakdown`(영역→업체 묶음 그룹, vendor_id
  null 직접 지출은 각자 그룹, area_budget 매칭·초과 플래그).
- `cache.ts`(신규, 순수·불변): `applyCreateExpense`(expense+options+payments 동시)·
  `applyUpdateExpense`·`applyDeleteExpense`(연관 제거)·`applyAddOption`/`applyDeleteOption`·
  `applyAddPayment`/`applyUpdatePayment`/`applyDeletePayment`/`applyTogglePayment`·`applyCreateVendor`·
  `applySetAreaBudget`(upsert)·`applyUpdateTotalBudget`.
- `hooks.ts`: 체크리스트 `useChecklistMutation`과 동일 구조의 제네릭 낙관적 뮤테이션 배선(두 슬라이스
  선례대로 공유 모듈로 추상화하지 않음 — YAGNI). 읽기 훅 + 쓰기 뮤테이션 훅.
- `components/`(신규): `budget-summary.tsx`(예산/약정/잔여 + 소비율 Meter + 예산 인라인 편집)·
  `settlement.tsx`(분담, 중립 미터)·`area-breakdown.tsx`+`vendor-group.tsx`(영역 섹션·업체 묶음·
  영역 예산 인라인 편집)·`expense-form.tsx`(단일 폼 섹션 분할, 업체 인라인 선택/신규, 옵션/납부
  동적 행, `CalendarPicker`로 납부일).

### ⑤ 화면 — `src/app/(tabs)/budget.tsx`

PlaceholderScreen 교체. `PageHead` + D-day. 섹션 조립(요약→분담→영역별). FAB "지출 추가"(expense-form
모달 — 체크리스트 폼 패턴). 영역/지출 탭 편집. 빈 상태 UI.

### ⑥ 테스트 — jest

- `api.test.ts`: `selectBudgetSummary`(약정·실지출·잔여·소비율, 빈→0, total_budget=0 경계)·
  `selectSettlementByPayer`(payer별 합·null 제외·빈→0)·`selectAreaBreakdown`(업체 그룹화·직접 지출·
  초과 플래그·예산 경계[같음/초과]). 보존성(개수·순서).
- `cache.test.ts`: 리듀서 멱등성·보존성·병리(없는 id 삭제·빈 옵션/납부 배열)·setAreaBudget upsert
  (기존 교체 vs 신규 추가)·delete cascade.

## 유닛 경계

| 유닛 | 하는 일 | 의존 |
|---|---|---|
| `0004_*.sql` | 예산 스키마 + 비용 쓰기 RPC | couple/area/expense 계열 |
| `lib/rpc` 래퍼(비용분) | RPC 호출 타입드화 | supabase·types/db |
| `features/budget/cache.ts` | 스냅샷 불변 패치(순수) | types/db only |
| `features/budget/api.ts` | 도메인 읽기·쓰기(코어) | lib/rpc |
| `features/budget/hooks.ts` | Query/Mutation 배선 | couple/hooks·api·cache |
| `features/budget/components` | 화면 전용 UI | components/ui·hooks |
| `app/(tabs)/budget.tsx` | 조립 | features/budget |

## 하지 않는 것 (경계)

- **`expense_split` 기반 "약정 분담"**(ADR-0004) — 지금은 실납부만.
- **vendors 화면 본구현** — 인라인 생성한 업체의 상태·역할·후보 관리는 vendors 슬라이스.
- **납부일·계약일의 일정 타임라인 병합** — 일정의 `TimelineItem`로 합류 대기(사용자 결정 2026-11-08).
- **홈 화면**(마지막 슬라이스, 세 도메인 집계).
- 알림(`notify_payments` 토글 연동)·푸시.

## 보강 — 납부/잔금 매핑 개정 (2026-11-10 실기기 피드백)

초판 구현 후 실기기 테스트에서 "예정/납부/잔금 추적 불가" 피드백 → 아래로 개정(마이그레이션 0005):
- **납부 = 실제 낸 돈만 여러 건**(종류: 예약금 DEPOSIT·중도금 INTERIM 신규·기타 ETC). `BALANCE`(잔금)는
  미사용(enum 유지).
- **잔금 = 지출 예정(최종금액) − Σ(완료 납부)**, **계산 표기**(저장 안 함, 과납 0 클램프). `payment`로
  입력하지 않는다. 분담 정산(실납부 기준, ADR-0004)은 그대로.
- 셀렉터: `VendorGroup`에 `paid`·`remaining` 추가(`paidByExpense` 맵). 영역별 배분 카드 = **예정|납부|잔금
  3셀 + 납부 진행 미터**(B안 — UI 선택지를 `design/budget-payment-variants.html` 웹 목업 3안으로 보여주고
  사용자가 선택, 상시 방침). ExpenseDetail에 잔금 자동 표기 줄 + 종류 칩(예약금/중도금/기타).

## 보강 2 — 소비율 기준·분담 명칭 개정 (2026-11-10 2차 실기기 피드백)

- **지출 진행률 기준 변경**: 메인 퍼센트(`spentRate`)를 "약정÷예산"(예산 소비율)에서 **"실지출÷약정"**
  으로 바꿨다 — 예산 소비율은 "예상과 실제 지출계획의 차이"를 보는 참고자료일 뿐 기준이 아니다(사용자
  명시). 기존 `budgetRate`는 참고 텍스트로 남긴다. `BudgetSummary` 타입 `consumeRate` → `spentRate` +
  `budgetRate` 분리.
- **분담 명칭 "나/애인/양가" → "신랑/신부/양가"**: DB enum(ME/PARTNER/BOTH_FAMILY)은 불변, 라벨만 변경
  (공유 코드 앱이라 "나"가 보는 사람에 따라 바뀌어 혼동을 줌).
- **분담 정산에 "미지정" 행 추가**: `payer=null`인 완료 납부를 숨기지 않고 4번째 행으로 노출
  (`selectSettlementByPayer`가 항상 신랑/신부/양가/미지정 4행 반환, totalPaid도 미지정 포함).

## 검증 (완료 판정)

- `npx tsc --noEmit` 0에러 · `npm test` 통과 · `npx eslint src` 0건(폴더 아닌 `src` 전체).
- 0004 라이브 적용 후 RPC 왕복·**격리 실측**(다른 share_code 교차 차단), 스냅샷에 area_budgets·
  total_budget·payer 포함.
- 기기/웹 CRUD **경계 포함** 실측: 빈 상태 첫 지출(업체 인라인+옵션+납부) → 요약·분담·영역 미터·
  초과 경고 갱신 / 잔금 납부완료 토글 → 실지출·분담 반영 / 예산 인라인 편집 → 소비율 재계산 /
  마지막 지출 삭제. 경계(빈 상태·초과·전액 납부·total_budget=0).
- 두 세션 Realtime 반영 + 낙관적 즉시성·실패 롤백 1건 실측.

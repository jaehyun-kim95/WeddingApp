# 코드 정의서 (Enum / 공통코드)

Postgres `enum` 타입 또는 `check` 제약으로 구현한다. **코드값은 영문 대문자(식별자), 명칭은 한글.**
새 코드값 추가는 허용(하위 호환), 제거·이름변경은 마이그레이션 + 데이터 이행 동반([README](README.md) 하위 호환 정책).

| 코드그룹 | 코드값 | 명칭 | 사용 테이블·컬럼 |
|---|---|---|---|
| `area_code` | SDM / HALL / INV / GIFT / HOME / GUEST | 스드메 / 웨딩홀 / 청첩장 / 예단예물 / 신혼집 / 하객 | `area.code` |
| `assignee` | ME / PARTNER / BOTH | 나 / 애인 / 공동 | `checklist_item.assignee`, `schedule_event.assignee` |
| `wedding_date_status` | UNDECIDED / APPROX / FIXED | 미정 / 대략 / 확정 | `couple.wedding_date_status` |
| `vendor_status` | CANDIDATE / CONTRACTED | 후보 / 계약 | `vendor.status` |
| `vendor_role` | STUDIO / DRESS / MAKEUP | 스튜디오 / 드레스 / 메이크업 | `vendor.role` (area=SDM일 때만) |
| `event_category` | EVENT / IMPORTANT / MILESTONE | 일정 / 중요 / 마일스톤(로드맵) | `schedule_event.category` |
| `payment_kind` | DEPOSIT / INTERIM / ETC / ~~BALANCE~~ | 예약금 / 중도금 / 기타 / ~~잔금~~ | `payment.kind` |
| `payer` | ME / PARTNER / BOTH_FAMILY | 나 / 애인 / 양가 | `payment.payer`(분담 정산 소스, ADR-0004) · `expense_split.payer`(미사용) |
| `guest_side` | GROOM / BRIDE | 신랑 측 / 신부 측 | `guest.side` |
| `guest_relation` | FAMILY / FRIEND / WORK / ACQUAINTANCE | 가족 / 친구 / 직장 / 지인 | `guest.relation` |
| `attend_status` | ATTENDING / MAYBE / ABSENT | 참석 / 미정 / 불참 | `guest.attend_status` |
| `origin` | SEED / USER | 표준 시드 / 사용자 입력 | `checklist_item.origin`, `schedule_event.origin` |

## 주의
- **PAYMENT는 `event_category`에 없다.** 납부일은 `payment` 테이블을 달력이 직접 조회해 표시하므로
  `schedule_event`의 카테고리로 넣지 않는다(중복 저장 금지). 로드맵 단계는 MILESTONE로 저장한다.
- `payer`의 `BOTH_FAMILY`(양가)는 나중에 `GROOM_FAMILY`/`BRIDE_FAMILY`로 쪼갤 여지가 있다 — 그때
  코드값만 추가하면 되고 스키마는 안 바뀐다(분담을 행으로 둔 이유, [README](README.md) 설계 원칙).
- `payment_kind`의 `BALANCE`(잔금)는 **미사용**(마이그레이션 0005). 잔금 = 약정(기본+옵션) − Σ(완료
  납부)로 **계산해 표기**하므로 종류로 입력하지 않는다. enum 값은 하위호환으로 남겨둔다(forward-only).
  중도금 `INTERIM`은 0005에서 추가.

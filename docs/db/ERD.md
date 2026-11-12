# ERD — 엔티티 관계도

전체 필드는 [table-definitions.md](table-definitions.md)가 단일 출처다. 이 문서는 **관계**를 본다.
렌더된 시각본: https://claude.ai/artifact/QLnL7pQHpZnipLwAsqKMSp

```mermaid
erDiagram
  couple ||--o{ checklist_item : "할 일"
  couple ||--o{ schedule_event : "일정"
  couple ||--o{ vendor : "업체"
  couple ||--o{ expense : "지출"
  couple ||--o{ guest : "하객"
  couple ||--o{ photo : "사진"
  couple ||--o{ area_budget : "영역예산"

  area ||--o{ checklist_item : "영역태그"
  area ||--o{ schedule_event : "영역태그"
  area ||--o{ vendor : "영역태그"
  area ||--o{ expense : "영역태그"
  area ||--o{ photo : "영역태그"
  area ||--o{ area_budget : "영역태그"

  vendor |o--o{ expense : "견적묶음(선택)"
  expense ||--o{ expense_option : "옵션=추가금"
  expense ||--o{ expense_split : "분담"
  expense ||--o{ payment : "납부"

  seed_checklist_item }o..|| area : "복사원본"
  seed_roadmap_step }o..o| area : "복사원본"

  couple {
    uuid id PK
    text share_code UK
    text groom_name
    text bride_name
    date wedding_date
    text wedding_date_status
    text venue
    bool show_auspicious_days
    bool notify_payments
    bigint total_budget
    bigint meal_price
  }
  area_budget {
    uuid id PK
    uuid couple_id FK
    uuid area_id FK
    bigint amount
  }
  area {
    uuid id PK
    text code UK
    text name_ko
    int sort_order
  }
  checklist_item {
    uuid id PK
    uuid couple_id FK
    uuid area_id FK
    text title
    text assignee
    bool is_done
    date due_date
    text origin
  }
  schedule_event {
    uuid id PK
    uuid couple_id FK
    uuid area_id FK
    text title
    date event_date
    text category
    text origin
  }
  vendor {
    uuid id PK
    uuid couple_id FK
    uuid area_id FK
    text name
    text status
    text role
    date contract_date
    bigint quoted_price
  }
  expense {
    uuid id PK
    uuid couple_id FK
    uuid area_id FK
    uuid vendor_id FK
    text title
    bigint base_amount
  }
  expense_option {
    uuid id PK
    uuid expense_id FK
    text name
    bigint amount
  }
  expense_split {
    uuid id PK
    uuid expense_id FK
    text payer
    bigint amount
  }
  payment {
    uuid id PK
    uuid expense_id FK
    text kind
    bigint amount
    date due_date
    text payer
    bool is_paid
  }
  guest {
    uuid id PK
    uuid couple_id FK
    text name
    text side
    text relation
    text attend_status
    bool is_host
    int meal_count
    bigint gift_amount
  }
  photo {
    uuid id PK
    uuid couple_id FK
    uuid area_id FK
    text storage_path
    text external_url
    bool is_video
  }
  seed_checklist_item {
    uuid id PK
    text area_code
    text title
    int sort_order
  }
  seed_roadmap_step {
    uuid id PK
    text title
    int months_before
    text area_code
  }
  auspicious_day {
    uuid id PK
    date day UK
    text note
  }
```

## 관계 읽는 법
- `couple ||--o{ *` — 커플 하나가 할일·일정·업체·지출·하객·사진을 여러 개 가진다(소유, `on delete cascade`).
- `area ||--o{ *` — 준비영역 하나가 여러 레코드에 태그로 붙는다(하이브리드 정보구조의 축).
- `vendor |o--o{ expense` — 지출은 업체에 **선택적으로** 묶인다. 업체 없는 직접 지출(청첩장 인쇄 등)은 `vendor_id`가 null.
- `couple ||--o{ area_budget` — 영역별 예산(영역당 1행, unique). 전체 예산은 `couple.total_budget` 컬럼.
- `expense ||--o{ expense_split` — 관계는 유지하나 **Phase 1 분담 정산은 `payment.payer`로 집계**한다
  ([ADR-0004](../decisions/0004-settlement-from-payments.md)) — `expense_split`은 당분간 미사용.
- `seed_* }o..|| area` — 점선은 FK가 아니라 **복사 원본** 관계. 설정 "표준 시드 불러오기"가 시드 행을
  커플의 `checklist_item`·`schedule_event`로 복사한다(원본은 안 바뀜).
- **달력 표시는 관계가 아니다**: 일정 화면 달력은 `payment.due_date`·`vendor.contract_date`를 직접
  조회해 점을 찍는다 — `schedule_event`로 복제 저장하지 않는다(중복 금지).

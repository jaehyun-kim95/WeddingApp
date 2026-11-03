# 테이블 정의서

코드값(enum)은 [code-definitions.md](code-definitions.md), 관계는 [ERD.md](ERD.md) 참조.

**공통 규칙**: 모든 테이블 `id uuid PK default gen_random_uuid()`, `created_at timestamptz default now()`.
커플 범위 테이블은 `couple_id uuid not null references couple(id) on delete cascade`를 갖는다
(아래 표에서 PK/created_at/couple_id는 생략하고 고유 필드만 적는다). 금액은 `bigint`(원 단위 정수).

---

## 1. 전역 참조 (couple_id 없음, 공개 읽기)

### area — 준비영역 마스터
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| code | text | unique, not null | `area_code` 코드값 |
| name_ko | text | not null | 화면 표시 한글명 |
| sort_order | int | not null | 필터 칩·섹션 정렬 순서 |

**불변식**: 표준 6행(SDM~GUEST)을 시드로 넣는다. **인덱스**: `code` unique.

### seed_checklist_item — 표준 체크리스트 시드
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| area_code | text | not null | 소속 영역(`area.code` 참조값) |
| title | text | not null | 할 일 제목 |
| sort_order | int | not null | 영역 내 순서 |

**용도**: 설정 "표준 시드 불러오기"가 이 행들을 커플의 `checklist_item`으로 복사한다(원본은 안 바뀜).

### seed_roadmap_step — 표준 역산 로드맵 시드
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| title | text | not null | 단계명 |
| months_before | int | not null | 예식일 기준 역산 개월수 |
| area_code | text | nullable | 관련 영역(없으면 전역 단계) |

**용도**: 결혼일 + `months_before`로 날짜를 계산해 커플의 `schedule_event`(category=MILESTONE)로 전개.

### auspicious_day — 길일(吉日)
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| day | date | unique, not null | 길일 날짜 |
| note | text | nullable | 참고 메모 |

**용도**: 만세력 기반 참조 데이터. 달력이 조회해 날짜 셀에 표식(`couple.show_auspicious_days`가 켜졌을 때).

---

## 2. 커플 범위 (couple_id 있음)

### couple — 커플 공용 저장소(루트)
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| share_code | text | unique, not null | 공유 코드(격리 키이자 접속 비밀) |
| groom_name | text | not null | 신랑 이름 |
| bride_name | text | not null | 신부 이름 |
| wedding_date | date | nullable | 예식일(미정이면 null) |
| wedding_date_status | enum | not null | `wedding_date_status` |
| wedding_time | time | nullable | 예식 시간 |
| venue | text | nullable | 예식 장소 |
| show_auspicious_days | bool | not null default true | 길일 표시 토글 |
| notify_payments | bool | not null default true | 납부일 알림 토글 |

**불변식**: `wedding_date_status=FIXED`면 `wedding_date not null`. **인덱스**: `share_code` unique(접속 조회).

### checklist_item — 체크리스트 할 일
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| area_id | uuid | not null → area | 준비영역 |
| title | text | not null | 할 일 |
| assignee | enum | not null | `assignee` |
| is_done | bool | not null default false | 완료 여부 |
| done_at | timestamptz | nullable | 완료 시각 |
| due_date | date | nullable | 일정(날짜) |
| memo | text | nullable | 메모 |
| origin | enum | not null default 'USER' | `origin`(SEED/USER) |
| sort_order | int | not null default 0 | 영역 내 순서 |

**불변식**: `is_done=true ↔ done_at not null`. **인덱스**: `(couple_id, area_id)` 영역 필터 조회.

### schedule_event — 일정 / 로드맵 마일스톤
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| area_id | uuid | nullable → area | 영역(전역 일정이면 null) |
| title | text | not null | 제목 |
| event_date | date | nullable | 날짜(미정 지원) |
| event_time | time | nullable | 시간 |
| location | text | nullable | 장소 |
| assignee | enum | nullable | `assignee` |
| category | enum | not null | `event_category` |
| reminder_at | timestamptz | nullable | 알림 시각 |
| origin | enum | not null default 'USER' | `origin` |

**불변식**: category=MILESTONE는 보통 origin=SEED(로드맵 전개). **인덱스**: `(couple_id, event_date)` 달력·아젠다 조회.

### vendor — 업체(정보 전용, ADR-0001)
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| area_id | uuid | not null → area | 준비영역 |
| name | text | not null | 업체명 |
| status | enum | not null | `vendor_status` |
| role | enum | nullable | `vendor_role`(area=SDM일 때만) |
| location | text | nullable | 위치 |
| contract_date | date | nullable | 계약일(달력 표시 소스) |
| quoted_price | bigint | nullable | 계약/견적 참고값 — **금액 소스 아님** |
| memo | text | nullable | 연락·메모 |

**불변식**: `status=CONTRACTED`면 보통 `contract_date not null`. `role`은 `area.code='SDM'`에서만 사용.
`quoted_price`는 참고 표시용이며 집계·분담에 쓰지 않는다(금액은 `expense`가 원장). **인덱스**: `(couple_id, area_id)`.

### expense — 지출(단일 원장, ADR-0001)
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| area_id | uuid | not null → area | 준비영역 |
| vendor_id | uuid | nullable → vendor | 업체 묶음(직접 지출이면 null) |
| title | text | nullable | 직접 지출 명칭(업체 연결이면 vendor.name 사용) |
| base_amount | bigint | not null default 0 | 기본 견적 금액(원) |

**불변식**: 최종금액 = `base_amount + Σ expense_option.amount` — **계산값, 저장 안 함.** `vendor_id`가
null이면 `title not null`(직접 지출). **인덱스**: `(couple_id, area_id)`, `(couple_id, vendor_id)`.

### expense_option — 지출 옵션(추가금)
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| expense_id | uuid | not null → expense | 소속 지출 |
| name | text | not null | 옵션명 |
| amount | bigint | not null, check > 0 | 추가금(원, 양수) |

**불변식**: `amount > 0`(옵션은 최종금액을 올리는 추가금). **인덱스**: `(expense_id)`.

### expense_split — 분담(나/애인/양가)
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| expense_id | uuid | not null → expense | 소속 지출 |
| payer | enum | not null | `payer` |
| amount | bigint | not null | 부담액(원) |

**불변식**: 한 지출 내 `(expense_id, payer)` unique(같은 부담자 중복 금지). 완전 배분 시
`Σ amount = 지출 최종금액`(부분 배분 허용 — 소프트 불변식). **인덱스**: `(expense_id)`.

### payment — 납부(예약금/잔금)
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| expense_id | uuid | not null → expense | 소속 지출 |
| kind | enum | not null | `payment_kind` |
| amount | bigint | not null | 납부액(원) |
| due_date | date | nullable | 납부 예정일(달력 표시 소스) |
| is_paid | bool | not null default false | 납부 완료 여부 |
| paid_at | timestamptz | nullable | 납부 시각 |

**불변식**: `is_paid=true ↔ paid_at not null`. 실지출 = `Σ amount where is_paid`, 약정 = `Σ 지출 최종금액`.
**인덱스**: `(couple_id, due_date)` 달력 조회, `(expense_id)`.

### guest — 하객
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| name | text | not null | 이름 |
| side | enum | not null | `guest_side` |
| relation | enum | not null | `guest_relation` |
| attend_status | enum | not null default 'MAYBE' | `attend_status` |
| is_host | bool | not null default false | 혼주 여부 |
| meal_count | int | not null default 1 | 식사 인원 |
| gift_amount | bigint | nullable | 축의금(원). null=미접수(혼주는 보통 null) |
| memo | text | nullable | 메모 |

**불변식**: `is_host=true`면 `gift_amount` 보통 null(혼주는 "—" 표시). **인덱스**: `(couple_id, side)`, `(couple_id, relation)`.

### photo — 갤러리 사진/영상
| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| area_id | uuid | nullable → area | 준비영역 분류 |
| storage_path | text | nullable | Supabase Storage 경로 |
| external_url | text | nullable | 외부 저장(용량 초과 시) URL |
| is_video | bool | not null default false | 영상 여부 |
| caption | text | nullable | 설명 |
| taken_at | timestamptz | nullable | 촬영 시각 |

**불변식**: `storage_path`와 `external_url` 중 **정확히 하나**는 not null(저장 위치는 ADR-0002 「결과」의
무료 용량 정책에 따름 — 3단계에서 1GB 초과 시 외부 전환 결정). **인덱스**: `(couple_id, area_id)`.

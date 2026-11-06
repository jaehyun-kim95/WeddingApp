---
name: 결혼 준비 관리 앱
description: 커플이 함께 쓰는, 청첩장처럼 품위 있는 결혼 준비 관리 웹앱
colors:
  ground: "#FBF7F4"
  ground-deep: "#F4ECE7"
  surface: "#FFFFFF"
  ink: "#332F2C"
  ink-muted: "#6B615B"
  ink-faint: "#978C85"
  line: "#ECE3DC"
  line-strong: "#DDD2C9"
  blush: "#C97E9A"
  blush-ink: "#9E466E"
  blush-soft: "#F6E7ED"
  sage: "#7E9270"
  sage-ink: "#556B47"
  sage-soft: "#E9EEE3"
  terracotta: "#B5603F"
  terracotta-ink: "#9A4A2B"
  terracotta-soft: "#F7E6DD"
typography:
  display:
    fontFamily: "Gowun Batang, Noto Serif KR, serif"
    fontSize: "66px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Gowun Batang, Noto Serif KR, serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.18
  subtitle:
    fontFamily: "Gowun Batang, Noto Serif KR, serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
  stat:
    fontFamily: "Gowun Batang, Noto Serif KR, serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Gowun Batang, Noto Serif KR, serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.3
  title-sm:
    fontFamily: "Gowun Batang, Noto Serif KR, serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  meta:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  tile: "16px"
  shell: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  xxxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blush}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  chip-soon:
    backgroundColor: "{colors.terracotta-soft}"
    textColor: "{colors.terracotta-ink}"
    rounded: "{rounded.pill}"
  chip-plan:
    backgroundColor: "{colors.sage-soft}"
    textColor: "{colors.sage-ink}"
    rounded: "{rounded.pill}"
  chip-area:
    backgroundColor: "{colors.blush-soft}"
    textColor: "{colors.blush-ink}"
    rounded: "{rounded.pill}"
---

# Design System: 결혼 준비 관리 앱

## Overview

**Creative North Star: "청첩장 스위트 (The Invitation Suite)"**

이 앱은 결혼 준비의 번잡함을 다루지만, 화면은 마치 둘이 함께 받아 든 청첩장 세트처럼 읽혀야 한다.
큰 세리프 이름, 얇은 헤어라인 괘선, 넉넉한 여백이 정보를 서두르지 않고 품위 있게 조직한다. 색은
사용자가 직접 지정한 **부드러운 계열** — 따뜻한 오프화이트 바탕 위에 블러시 로즈와 세이지 그린이
번갈아 할 일을 맡는다. 이 시스템은 참고 삼은 "웨딩 플래너 앱"의 카테고리 기본값(둥근 파스텔 카드
그리드, 그림자 짙은 스탯 타일)을 명시적으로 거부한다 — 카드 그리드 대신 헤어라인으로 나뉜 에디토리얼
리스트를, 짙은 그림자 대신 은은한 오프셋 블러를 쓴다.

**Key Characteristics:**
- 세리프 디스플레이(Gowun Batang) + 산세리프 본문(Noto Sans KR)의 뚜렷한 위계
- 헤어라인 괘선이 섹션을 나누는 주된 구조 장치 (카드 테두리가 아니라)
- 블러시는 강조에만, 세이지는 진행/완료에만 — 색은 적게, 의미 있게
- D-day 숫자가 모든 화면의 중력 중심

## Colors

바탕은 하나의 따뜻한 오프화이트 램프, 악센트는 블러시·세이지·테라코타 세 가지뿐이다.

### Primary
- **블러시 로즈** (`#C97E9A` 채움 / `#9E466E` 텍스트): D-day 숫자, 주 버튼, 활성 탭, 예산 소비율
  미터, '준비영역' 칩. 큰 글자(≥24px·3:1)는 `#C97E9A`로, 본문 크기 텍스트는 AA(4.5:1)를 만족하는
  `#9E466E`로 — 같은 역할이라도 크기에 따라 두 톤을 구분해 쓴다.

### Secondary
- **세이지 그린** (`#7E9270` 채움 / `#556B47` 텍스트): 전체 진행률 미터, 완료 체크박스, '예정'(날짜
  없음) 상태 칩, 체크리스트 '오늘' 칩. "다 돼간다"는 안도감을 맡는다.

### Tertiary
- **뮤트 테라코타** (`#B5603F` 채움 / `#9A4A2B` 텍스트): '임박' 상태, 길일(吉日) 날짜 표시, 체크리스트
  '지남' 칩. 경고이되 비명 지르지 않는 톤.

### Quaternary
- **더스티 블루** (`#6B8CAE` 채움 / `#3F5F7D` 텍스트): 체크리스트 '예정'(날짜 있음) 상태 칩 전용
  (실사용 피드백으로 추가 — 지남=붉은 계열·오늘=초록 계열·예정=푸른 계열로 3단계 구분). 기존 3색과
  같은 채움/ink/soft 3톤 체계, 같은 톤 다운 강도.

### Neutral
- **바탕 오프화이트** (`#FBF7F4`): 앱 전역 배경.
- **깊은 오프화이트** (`#F4ECE7`): 바로가기 밴드 등 구획 배경 없이, 앱 바깥 캔버스·탭바 틴트에 사용.
- **표면 화이트** (`#FFFFFF`): 바로가기 아이콘 타일 등 절제해서 사용하는 패널.
- **잉크** (`#332F2C`): 본문 텍스트.
- **잉크 뮤트** (`#6B615B`): 보조 텍스트·메타 정보. AA 통과 최저선.
- **잉크 희미** (`#978C85`): 3차 장식용(큰 글자에 한함). 본문 크기에는 쓰지 않는다.
- **헤어라인** (`#ECE3DC`) / **강한 괘선** (`#DDD2C9`): 섹션·리스트 구분선.

### Named Rules
**The Soft-Palette Rule.** 배경은 오프화이트 하나로 고정한다(사용자 확정 결정). 색 구분이 필요한
묶음 경계는 배경색이 아니라 **헤어라인 괘선**으로만 표현한다 — 바로가기 메뉴 밴드가 그 예다.
**예외(사용자 확정): 달력 패널만 표면 화이트(`surface`) 배경 + 헤어라인 프레임을 쓴다.** 날짜 셀에
입혀진 색(주말 블러시·길일 테라코타·일정 언더바 마커)이 오프화이트 바탕과 섞여 가독성이 떨어진다는
사용자 피드백에 따른 결정 — 달력 안의 "표기된 색"을 또렷이 보이게 하려는 목적이며, 이 예외는 달력
패널에 한한다(리스트 등 다른 묶음은 여전히 배경색 없이 프레임/여백으로만 구분).
**The Two-Tone Accent Rule.** 블러시·세이지·테라코타는 각각 "채움(장식·배경)"과 "텍스트(AA 대비)"
두 톤을 갖는다. 작은 텍스트에 장식 톤을 쓰지 않는다.
**The One-Axis Color Rule(한 화면 한 색축).** 한 화면에서 **색이 의미를 나르는 축은 하나**다. 한
화면에 서로 다른 두 분류(예: 비용의 '예산 상태' vs '분담 주체')가 있으면, 색은 더 중요한 한 축에만
쓰고 다른 축은 중립 톤(웜그레이 `ink-3`)으로 두고 라벨·길이로 구분한다. 3색 팔레트를 두 축에 겹쳐
쓰면 서로 다른 뜻이 같은 색으로 보여 혼동된다(사용자 확정 — 비용 화면에서 지출↔나·잔액↔애인 색
겹침을 겪고 내린 결정). 비용 화면의 적용: 색은 '예산 상태'(지출=블러시·잔액=세이지·소비율 미터=
블러시·예산 초과=테라코타)에만, '분담 정산'(나/애인/양가) 미터는 중립 `ink-3`로 통일한다.

## Typography

**Display Font:** Gowun Batang (with Noto Serif KR, serif 폴백)
**Body Font:** Noto Sans KR (with system-ui 폴백)

**Character:** 한국어 세리프의 차분한 무게감과, 실용적인 산세리프 본문의 조합. 청첩장 조판의 우아함을
Operate 화면의 스캔성과 절충한다 — 디스플레이는 감정을, 본문은 정보를 맡는다.

### Hierarchy
11단계 고정 스케일. 화면이 늘어도 이 표 밖의 크기를 새로 만들지 않는다 — 필요하면 가장 가까운
기존 단계를 쓴다.

| 역할 | 무게/크기 | 용도 |
|---|---|---|
| **Display** | 700, 66px, lh .95 | D-day 센터피스 숫자 전용(모든 화면에 재등장하는 유일한 요소) |
| **Headline** | 700, 30px, lh 1.18 | 홈 마스트헤드의 신랑·신부 이름 |
| **Subtitle** | 700, 26px | 서브 화면 `page-title`("일정", "비용" 등), D-day의 "D-" 접두사 |
| **Stat** | 700, 22px | 서브 화면 헤더의 소형 D-day 레퍼런스 숫자 |
| **Title** | 700, 19px | 섹션 제목("다음 할 일" 등) |
| **Title-sm** | 700, 16px | 캘린더 월 레이블("2026년 10월") |
| **Body** | 400, 15px, lh 1.5 | 리스트 항목 본문. 숫자는 항상 tabular-nums |
| **Body-sm** | 500, 14px | 버튼 라벨, 미터 강조 수치 |
| **Meta** | 400, 13px | 보조 메타(날짜/장소), 세그먼트 탭 라벨, `page-sub` |
| **Caption** | 400, 12px | 리스트 부제(담당자 등), 3차 보조 텍스트 |
| **Label** | 500, 11px, letter-spacing .02em | 칩, 캘린더 범례·요일, 탭바, 로드맵 스텝 라벨 — 기능 텍스트 최저선(11px) |

Display·Headline·Subtitle·Title·Title-sm은 세리프, 나머지는 산세리프(The Serif-for-Names Rule).

### Named Rules
**The Serif-for-Names Rule.** 세리프 디스플레이는 사람 이름·D-day·섹션 제목에만 쓴다. 리스트 본문과
폼 입력은 언제나 산세리프 — 세리프를 본문에 쓰면 이 시스템이 무너진다.

## Layout

모바일 우선, 앱 셸 최대 폭 430px(데스크톱에서는 가운데 정렬 + 바깥 캔버스가 `ground-deep`으로 비침).
화면 패딩은 좌우 20px(`--s5`), 섹션 간 32px(`--s7`). 하단 고정 탭바(64px) 때문에 본문 하단에
`tabbar-h + 32px` 여유를 둔다. 리스트는 헤어라인으로만 구분하고 카드 컨테이너를 쓰지 않는다. 가로
스크롤 영역(바로가기)은 양 끝에 화면 패딩과 동일한 스페이서를 둬 시작/끝 여백이 대칭이어야 한다.

## Elevation & Depth

이 시스템은 **거의 평면적**이다. 그림자는 두 곳에만 등장한다: 앱 셸 바깥 윤곽(`shadow-md`)과 바로가기
아이콘 타일(`shadow-sm`). 둘 다 색이 있는 은은한 오프셋 블러(`rgba(90,55,65,.07~.10)`)이며, 0-오프셋
컬러 헤일로나 짙은 블록 그림자는 쓰지 않는다. 구조적 깊이는 그림자가 아니라 **헤어라인 괘선**이 만든다.

### Shadow Vocabulary
- **ambient-shell** (`0 8px 22px rgba(90,55,65,.10)`): 앱 셸 전체 윤곽(데스크톱 캔버스 위).
- **ambient-tile** (`0 2px 8px rgba(90,55,65,.07)`): 바로가기 아이콘 타일 등 떠 있는 작은 요소.

### Named Rules
**The Hairline-Over-Shadow Rule.** 두 영역을 나눌 때 먼저 괘선을 고려하고, 그림자는 떠 있는 작은
요소(아이콘 타일)에만 최후 수단으로 쓴다.

## Shapes

둥근 정도는 절제된 5단계 고정 스케일: 포커스 링·체크박스 등 작은 통제 요소 `sm`(6px), 일반 패널
`md`(10px), 날짜 셀 등 `md` 주변 요소, 아이콘 타일 `tile`(16px), 앱 셸 바깥 윤곽(데스크톱 캔버스)만
예외적으로 `shell`(18px), 알약형 칩·버튼·미터·세그먼트 컨트롤은 완전한 `pill`(999px). 날카로운
직각은 쓰지 않지만, 큰 반경의 "소프트 카드" 룩도 피한다 — 이 시스템의 둥긂은 장식이 아니라 손이
닿는 요소(버튼·타일·칩)와 셸 윤곽에만 있다. 새 반경 값을 만들지 않고 이 5단계 중 가장 가까운
것을 쓴다.

## Components

### Buttons
- **Shape:** 완전한 pill (`border-radius: 999px`).
- **Primary:** 블러시 채움(`#C97E9A`) + 흰 텍스트, 패딩 10px 20px.
- **Ghost:** 투명 배경 + `line-strong` 1px 보더 + 잉크 텍스트. 보조 액션에 사용.
- **Hover / Focus:** 포커스 링은 블러시 2px 아웃라인 + 2px 오프셋(`:focus-visible`).

### FAB (플로팅 추가 버튼) — 화면 공유 컴포넌트
- **용도:** 리스트가 긴 화면(체크리스트 등)의 주 추가 액션. 하단 고정 버튼 대신 떠 있어, 끝까지
  스크롤하지 않아도 늘 '추가'에 닿는다. 여러 화면이 `system.css`로 공유한다.
- **Position:** 탭바와 같은 '중앙 정렬 앱 폭' 기준(`fixed` + `left:50%` + `translateX(-50%)` +
  `max-width:430px`)으로 떠서 앱 폭 내부 **우측 하단**, 탭바 바로 위(`bottom = 탭바높이 + 6px`)에
  놓인다(실사용 피드백으로 재차 축소 — 5~10px 범위의 고정값, spacing 스케일에 맞는 단계가 없어
  컴포넌트 전용 매직넘버). 래퍼(`.fab-wrap`)는 `pointer-events:none`, 실제 버튼만 클릭된다. 데스크톱은
  body의 24px 하단 패딩만큼 FAB을 올려 탭바와의 간격을 유지한다.
- **Style:** 원형 56×56px, 중앙에 "+" 글리프(28px)만 — 라벨 텍스트 없음(실사용 피드백 — 모든 화면의
  FAB이 "추가" 동작이라 아이콘만으로 의미가 분명함, 접근성 라벨은 `accessibilityLabel`로 유지).
  **배경은 `blush`가 아니라 `blush-ink`(`#9E466E`)** — 흰 글리프와 AA 대비(≈5.9:1)를 확보하기 위함.
  작은 흰 요소를 `blush` 원색(≈3:1) 위에 올리지 않는다(The Two-Tone Accent Rule). 떠 있는 요소이므로
  `ambient-shell`(`shadow-md`) 그림자를 쓴다.

### Chips
- **Style:** 배경은 역할색의 `-soft` 톤, 텍스트는 역할색의 `-ink` 톤. 테두리 없음.
- **Variants:** `soon`(테라코타, 임박) · `plan`(세이지, 날짜 없는 예정) · `area`(블러시, 준비영역 태그) ·
  `ghost`(투명 + 보더, 중립 라벨) · `overdue`(테라코타, 지남) · `today`(세이지, 오늘 — 초록 계열) ·
  `upcoming`(블루 `#6B8CAE`/`#3F5F7D`/`#E7EDF3`, 날짜 있는 예정 — 신규 Quaternary 톤).
- **체크리스트 날짜 상태:** 완료되지 않은 항목에 날짜가 있으면 오늘 기준으로 지남/오늘/예정 3단계를
  문자열 비교로 가른다(`due_date`가 date-only라 사전식 비교로 충분). 날짜가 없으면 중립 `plan`.

### List Rows (에디토리얼 리스트)
- **Corner Style:** 없음 — 컨테이너가 아니라 헤어라인(`1px solid line`)으로 구분된 행.
- **Internal Rhythm:** 행 패딩 16px 수직, 좌측에 체크박스/리드 요소, 우측에 날짜·상태.
- **Checkbox:** 20px 정사각, 6px 라운드, 완료 시 세이지 채움 + 흰 체크마크.

### Vendor Contract Panel (업체 계약 패널 · 업체 화면)
- **용도:** 계약 확정 업체를 강조하는 흰 표면 패널(`surface` + `line-2` 프레임). 후보(검토 중)
  리스트는 일반 에디토리얼 리스트로 아래에 둔다.
- **구성:** 이름 + 역할 칩(`ghost`: 스튜디오/드레스/메이크업 등, 한 영역 여러 업체일 때) + 계약
  리본(`chip plan`), 위치·계약일, 우측 **계약 견적(기본값) 참고**, 하단 "옵션·납부는 비용에서"
  링크(헤어라인 구분). **금액 상세(옵션·납부)는 여기 두지 않는다 — 비용이 지출 원장(ADR-0001).**

### Budget Vendor Group (비용 업체 묶음 · 비용 화면)
- **용도:** 비용 화면에서 한 영역 안의 업체별 지출을 "기본 견적 + 옵션 → 최종금액"으로 보여준다.
- **구성:** 업체명(+역할 칩) + 우측 **최종금액**(세리프), 아래 라인 목록 — 기본 견적 1줄 + 옵션
  여러 줄. **옵션 줄은 앞에 `+`(블러시-잉크)와 블러시-잉크 금액**으로 추가금임을 표시(최종금액을
  끌어올린 항목). 영역 소계 = 업체 최종금액 합, 예산과 비교(초과는 테라코타 미터). 업체 없는 직접
  지출은 "직접 지출" 칩.

### Calendar (달력 패널)
- **Panel:** `surface` 흰 배경 + `line-2` 1px 헤어라인 프레임 + `r-md`(10px) 라운드. 홈 미니
  캘린더와 일정 화면이 공유한다(Soft-Palette Rule의 달력 예외).

### Calendar Day Cell
- **Shape:** 정사각(`aspect-ratio:1`), 6px 라운드.
- **State:** 기본(잉크) / 흐림(다른 달, 비표시로 처리해 대비 문제 회피) / **주말(토·일 모두 블러시
  텍스트)** / 길일(테라코타 텍스트+굵게) / 오늘(블러시-잉크 채움 + 흰 숫자). 우선순위는 오늘 >
  길일 > 주말 순으로, 겹칠 때 더 구체적인 상태가 색을 이긴다.
- **Event markers (언더바):** 일정 있는 날은 숫자 아래 **카테고리색 언더바**(가로 막대, 셀 폭 62%·
  높이 3px·pill)로 표기한다(사용자 확정 — 점 표기 대체). 점보다 또렷하고, 한 날에 여러 건이면
  막대를 **세로로 쌓아 개수까지** 드러난다. 색으로 종류 구분 — 일정=세이지, 납부=블러시, 중요=테라
  코타. 오늘 칸(블러시-잉크 채움) 위에서는 막대를 흰색으로 반전한다. 범례(`.leg`) 샘플도 같은 색
  막대(11×3px)로 맞춘다. "무슨 일정인지"는 셀이 아니라 날짜 선택 시 아래 일정 리스트가 맡는다.

### Calendar Picker (날짜 선택 모달)
- **용도:** 폼에서 날짜 하나를 고르는 입력 전용 모달(체크리스트 등). 읽기 전용 Calendar 패널과
  달리 네이티브 OS/브라우저 피커를 쓰지 않는다 — 네이티브 피커는 "오늘" 표시를 우리 디자인대로
  커스터마이즈할 수 없어(실사용 피드백) 완전히 커스텀으로 만든 컴포넌트.
- **Panel:** 화면 중앙 다이얼로그(320px 폭, `surface` 배경, `line-strong` 1px, `r-md` 10px 라운드),
  반투명 블랙 백드롭(탭하면 닫힘). 헤더에 ‹ 월 이동 › + Title-sm 월 레이블("2026년 11월").
- **Day Cell:** Calendar Day Cell의 색 규범을 그대로 따른다 — 주말(토·일)은 블러시 텍스트, 오늘은
  블러시-잉크. 다만 **오늘 표시는 칸 전체를 채우는 둥근 사각이 아니라 32px 원(`radius.pill`)** 이다
  (읽기 전용 달력과의 의도된 차이 — 선택 UI임을 시각적으로 구분). 다른 달 칸은 완전히 빈 칸(Calendar
  Day Cell과 동일 규범).
- **선택 상태(신규):** 오늘이 아닌 날짜를 선택하면 블러시-잉크 2px 테두리 링으로 표시한다(채움 아님
  — 채움은 "오늘" 전용으로 남겨 둘을 구분). 선택 날짜가 곧 오늘이면 오늘의 채움 원이 우선한다(기존
  "오늘 > 길일 > 주말" 우선순위와 같은 원칙 — 더 구체적인 상태가 이긴다).

### Quicknav Tile (바로가기)
- **Style:** 52px 정사각 표면 화이트 타일, 16px 라운드, `line` 1px 보더, `ambient-tile` 그림자,
  아이콘은 블러시-잉크 24px 드로운 SVG.
- **Layout:** 가로 스크롤, 스크롤바 숨김(터치/드래그로만 스크롤), 양 끝 대칭 스페이서.

### Page Head (서브 화면 헤더)
- **Style:** 좌측에 Subtitle(26px) 페이지 제목 + Meta(13px) 서브텍스트, 우측에 Stat(22px) 소형
  D-day 레퍼런스. 하단 `line-strong` 헤어라인 1px.
- **Rule:** 홈이 아닌 모든 화면은 거대한 D-day 센터피스 대신 이 소형 레퍼런스를 쓴다 — 센터피스는
  홈 전용.

### Segmented View Toggle (세그먼트 컨트롤)
- **Style:** `ground-deep` 트랙(pill, `line-strong` 1px 보더) 위에 등폭 세그먼트 2개 + Meta(13px) 라벨.
  선택 표식은 **미끄러지는 썸**(`.seg-thumb`) — `surface` 흰 배경 + `ambient-tile` 그림자로 "떠 있음"을
  표현(썸 width = `calc(50% - 3px)`, 두 세그먼트 등폭 전제). 선택 라벨은 `ink`(진하게), 비선택은 `ink-muted`.
- **Motion:** 세그먼트 전환 시 썸이 `transform: translateX` + `.28s cubic-bezier(.4,0,.2,1)`로 부드럽게
  이동한다. `prefers-reduced-motion:reduce`에서는 transition 제거.
- **Behavior:** 순수 CSS(숨긴 라디오 버튼 + `:checked` 형제 선택자)로 구현, JS 불필요. 어느 라디오가
  어느 세그먼트/뷰인지(썸 transform·뷰 show/hide)는 화면별 `<style>`에서 id로 배선.

### Meter (진행률/소비율 미터)
- **Motion:** `value`가 바뀌면 채움 바 너비가 즉시 점프하지 않고 `.4s cubic-bezier(.4,0,.2,1)`로
  부드럽게 늘고 줄어든다(Segmented와 같은 모션 어휘, 실사용 피드백으로 추가). `prefers-reduced-motion:
  reduce`에서는 즉시 반영.
- **Layout:** 토글과 그 아래 콘텐츠(캘린더/리스트) 사이 간격은 섹션 간격(`--s7`)으로 통일 — 뷰를
  바꿔도 버튼↔콘텐츠 간격이 달라지지 않는다.

### Roadmap Rail (준비 로드맵)
- **Style:** 가로 스크롤 스텝 레일. 각 스텝은 18px 원(`dot`) + 11px Label. 완료는 세이지 채움,
  현재는 블러시 채움 + `blush-soft` 헤일로 링, 미래는 빈 원(`line-strong` 보더). 스텝 사이는
  1px 연결선(완료 구간은 세이지, 그 외 `line-strong`).
- **Layout:** Quicknav Tile과 동일한 양 끝 대칭 스페이서 패턴을 공유한다.

### Navigation (하단 탭바)
- **Style:** 고정 하단, 반투명 오프화이트 + 블러, 상단 1px 보더. 5개 탭 아이콘(23px 드로운 SVG, 현재
  라벨 전용으로 보류) + **Body-sm(14px) 라벨**(실사용 피드백으로 11px→14px 확대, 가독성). 활성 탭은
  블러시-잉크, 비활성은 잉크 뮤트(AA 통과).
- **활성 탭 인디케이터:** 탭바 상단에 블러시-잉크 2px 바가 활성 탭 아래에서 슬라이딩한다(등폭 5분할,
  Segmented와 동일한 `translateX` + `.28s cubic-bezier(.4,0,.2,1)` 모션 어휘 재사용). `prefers-reduced-motion`
  에서는 즉시 이동.

### D-day Centerpiece (시그니처 컴포넌트)
각 화면의 중력 중심. "D-" 접두사(26px)와 숫자(66px)를 같은 줄 베이스라인에 정렬, 모두 세리프·
블러시-잉크. 아래 13px 레이블이 설명한다. 이 컴포넌트는 변형하지 않는다 — 모든 화면에서 동일한
형태로 재등장해 "지금 결혼까지 며칠"이라는 단일 진실을 유지한다.

## Do's and Don'ts

### Do:
- **Do** 묶음(섹션) 경계는 헤어라인 괘선 또는 여백으로 표현한다.
- **Do** 블러시는 "지금·D-day·주 액션"에만, 세이지는 "진행·완료"에만 쓴다 — 역할을 섞지 않는다.
- **Do** 본문 크기 텍스트에는 항상 `-ink` 톤(AA 통과)을 쓰고, 장식 톤(`blush`/`sage`/`terracotta`
  원색)은 24px 이상 큰 글자나 채움(배경·아이콘)에만 쓴다.
- **Do** 숫자(날짜, 금액, D-day)에는 `tabular-nums`를 적용한다.

### Don't:
- **Don't** 아이콘·제목·텍스트가 같은 크기로 반복되는 카드 그리드를 화면 구조로 쓰지 않는다 — 이
  시스템은 리스트와 괘선으로 조직한다.
- **Don't** 제목 위에 킥커/eyebrow 라벨을 달지 않는다.
- **Don't** 그림자를 짙게 쓰거나(block shadow), 카드에 컬러 보더를 좌/우로 달지 않는다.
- **Don't** 블러시 원색(`#C97E9A`)을 본문 크기 텍스트나 보조 라벨에 쓰지 않는다(대비 미달).
- **Don't** 다른 달의 날짜 칸을 흐리게 채워 넣지 않는다(저대비 유발) — 빈 칸으로 비운다.

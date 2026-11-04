# 디자인 토큰 (theme.ts 교체) — 설계 스펙

- **날짜**: 2026-11-04
- **Phase**: 개발 Phase 0 (개발 기반) — 첫 작업 단위
- **범위**: scaffold 기본 `src/constants/theme.ts`를 DESIGN.md 디자인 시스템 토큰으로 전면 교체.
- **단일 출처**: 값은 [`DESIGN.md`](../../../DESIGN.md) 및 [`.impeccable/design.json`](../../../.impeccable/design.json)가 소유한다. 이 스펙은 **RN 표현으로의 변환 규칙과 파일 구조**만 확정한다. 값이 어긋나면 DESIGN.md가 이긴다.

## 1. 목적 / 성공 기준

DESIGN.md의 색·타이포·반경·간격·그림자를 React Native에서 타입 안전하게 쓸 수 있는 토큰 모듈로 옮긴다. 이후 공용 컴포넌트·화면이 모두 이 토큰만 참조한다(하드코딩된 색·크기 금지).

**완료 판정(이 단계)**
- [ ] `npx tsc --noEmit` 0에러 (새 토큰 추가 + 다크 제거 후, 레거시 유지로 scaffold 데모 포함 컴파일)
- [ ] 토큰 값이 DESIGN.md와 1:1 일치 (아래 변환표 대조)
- [ ] 다크 분기가 코드에서 제거됨 (`useColorScheme`이 항상 `light`, app config `userInterfaceStyle: "light"`)

실제 화면 렌더 확인은 다음 단계(공용 컴포넌트·네비 뼈대)에서 수행한다 — 이 단계는 토큰 모듈과 컴파일 그린까지.

### 경계 수정(2026-11-04, 구현 중 발견)

scaffold 데모 파일(`explore.tsx`·`index.tsx`·`app-tabs`·`hint-row`·`web-badge`·`animated-icon`)이 기존 토큰 export(`Colors`·`Fonts`·`Spacing`·`ThemeColor`·`BottomTabInset`·`MaxContentWidth`)에 강하게 묶여 있다. 이 export들을 지우면 해당 데모 파일이 전부 tsc 에러가 나는데, **데모 파일 제거는 네비 뼈대 단계 몫**이다. 따라서 경계를 아래로 조정한다:

- **이 단계** = 새 토큰 모듈을 **추가** + 다크 분기 제거. 기존 토큰은 `@deprecated` 레거시로 **남겨둔다**(곧 삭제될 데모 전용). 새/레거시는 대소문자로 이름이 갈려(`colors`↔`Colors`) 충돌하지 않는다.
- **다음(공용 컴포넌트) 단계** = `themed-text`/`themed-view`/`use-theme`를 새 토큰으로 이관 + 데모 파일 제거 + 레거시 export 삭제.

이 경계는 "아무것도 깨지 않으므로 tsc 그린이 자명"하고 범위가 "디자인 토큰"에 정확히 맞는다.

## 2. 결정 사항

- **다크모드: 지원 안 함(Light 단일 고정)** — 사용자 확정(2026-11-04). DESIGN.md에 다크 팔레트가 없고 비주얼 방향이 "따뜻한 오프화이트 단일 월드"로 확정("변경 금지")이므로, 다크 분기 자체를 제거한다. scaffold의 `Colors.light` / `Colors.dark` 이원 구조를 **단일 팔레트**로 바꾼다.
- **구조: DESIGN.md 이름 1:1 미러링(접근 A)** — 색·타이포·반경·간격 토큰 키를 DESIGN.md 명칭 그대로 camelCase로 둔다. 문서·`design/*.html` 목업 CSS 변수·코드가 **한 어휘**를 공유해 드리프트를 막는다. (반려안: 시맨틱 전용 B, scaffold 슬롯 유지 C — 둘 다 번역 비용/손실로 기각.)

## 3. 토큰 모듈 구조 (`src/constants/theme.ts`)

named export로 아래 객체들을 내보낸다. 모두 `as const`.

```ts
export const colors  = { ... } as const;   // 색 17종
export const type    = { ... } as const;   // 타이포 11단계
export const fonts   = { ... } as const;   // 패밀리명 문자열(로딩은 이 단계 밖)
export const radius  = { ... } as const;   // 반경 6키
export const spacing = { ... } as const;   // 간격 7키
export const shadow  = { ... } as const;   // 그림자 2종(RN 형식)
export const layout  = { ... } as const;   // 셸/패딩/탭바 치수

export type ColorToken = keyof typeof colors;
export type TypeToken  = keyof typeof type;
```

### 3.1 colors (단일 팔레트, DESIGN.md 17종)

| 토큰 | 값 | 토큰 | 값 |
|---|---|---|---|
| `ground` | `#FBF7F4` | `blush` | `#C97E9A` |
| `groundDeep` | `#F4ECE7` | `blushInk` | `#9E466E` |
| `surface` | `#FFFFFF` | `blushSoft` | `#F6E7ED` |
| `ink` | `#332F2C` | `sage` | `#7E9270` |
| `inkMuted` | `#6B615B` | `sageInk` | `#556B47` |
| `inkFaint` | `#978C85` | `sageSoft` | `#E9EEE3` |
| `line` | `#ECE3DC` | `terracotta` | `#B5603F` |
| `lineStrong` | `#DDD2C9` | `terracottaInk` | `#9A4A2B` |
| | | `terracottaSoft` | `#F7E6DD` |

### 3.2 type (11단계)

각 항목: `{ fontFamily, fontSize, fontWeight, lineHeight, letterSpacing? }`.

- **`fontFamily`**: DESIGN.md의 Serif-for-Names Rule에 따라 display/headline/subtitle/stat/title/titleSm = `fonts.serif`, 나머지(body/bodySm/meta/caption/label) = `fonts.sans`.
- **`lineHeight`**: RN은 px 절대값을 받으므로 `round(fontSize × DESIGN.md 배율)`로 환산.
- **`letterSpacing`**: RN은 px(dp) 절대값 → `em × fontSize`로 환산. 미지정 단계는 생략(0).
- **`fontWeight`**: number.

| 토큰 | family | size | weight | lh 배율→px | letterSpacing |
|---|---|---|---|---|---|
| `display` | serif | 66 | 700 | 0.95 → 63 | -0.02em → -1.32 |
| `headline` | serif | 30 | 700 | 1.18 → 35 | — |
| `subtitle` | serif | 26 | 700 | 1.2 → 31 | — |
| `stat` | serif | 22 | 700 | 1.1 → 24 | — |
| `title` | serif | 19 | 700 | 1.3 → 25 | — |
| `titleSm` | serif | 16 | 700 | 1.3 → 21 | — |
| `body` | sans | 15 | 400 | 1.5 → 23 | — |
| `bodySm` | sans | 14 | 500 | 1.4 → 20 | — |
| `meta` | sans | 13 | 400 | 1.4 → 18 | — |
| `caption` | sans | 12 | 400 | 1.4 → 17 | — |
| `label` | sans | 11 | 500 | 1.4 → 15 | 0.02em → 0.22 |

> 참고: `tabular-nums`는 토큰이 아니라 사용처(숫자 표시)에서 `fontVariant: ['tabular-nums']`로 적용한다(DESIGN.md Do).

### 3.3 fonts

```ts
export const fonts = { serif: 'GowunBatang', sans: 'NotoSansKR' } as const;
```

패밀리명 **문자열만** 둔다. 실제 폰트 파일 로딩(expo-font / @expo-google-fonts)과 Noto Serif KR 폴백 처리는 **다음 단계(공용 컴포넌트 전)**에서 배선한다 — 토큰 파일 책임 밖. (로딩 전까지 RN은 시스템 폰트로 폴백하므로 컴파일·동작에 지장 없음.)

### 3.4 radius / spacing / layout

```ts
export const radius  = { sm: 6, md: 10, lg: 14, tile: 16, shell: 18, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const layout  = { appMaxWidth: 430, screenPadding: 20, sectionGap: 32, tabBarHeight: 64 } as const;
```

- `radius`·`spacing`은 DESIGN.md Shapes/spacing과 1:1.
- `layout`: DESIGN.md Layout 절 — 앱 셸 430px, 화면 좌우 패딩 20px(`--s5`), 섹션 간 32px(`--s7`), 탭바 64px. scaffold의 `MaxContentWidth=800`·`BottomTabInset`은 제거/대체.

### 3.5 shadow (RN 형식)

DESIGN.md Shadow Vocabulary. CSS `rgba(90,55,65,α)` = `#5A3741` + opacity. RN은 iOS(shadow*)와 Android(elevation)를 함께 둔다.

```ts
export const shadow = {
  ambientShell: { shadowColor: '#5A3741', shadowOffset: { width: 0, height: 8 }, shadowRadius: 22, shadowOpacity: 0.10, elevation: 8 },
  ambientTile:  { shadowColor: '#5A3741', shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,  shadowOpacity: 0.07, elevation: 2 },
} as const;
```

`ambientShell` = 앱 셸 윤곽(데스크톱 캔버스), `ambientTile` = 바로가기 타일 등 떠 있는 작은 요소. (Hairline-Over-Shadow Rule — 구조 구분은 괘선, 그림자는 이 둘뿐.)

## 4. 함께 바뀌는 파일 (토큰 교체의 파급)

토큰 모듈 shape이 바뀌면 기존 소비자가 깨지므로 같은 단위로 처리한다.

| 파일 | 변경 |
|---|---|
| `src/constants/theme.ts` | 새 토큰 export **추가**(`colors`·`type`·`fonts`·`radius`·`spacing`·`shadow`·`layout`). 기존 export는 `@deprecated` 주석과 함께 유지 |
| `src/hooks/use-color-scheme.ts` / `.web.ts` | 항상 `'light'` 반환 (다크 제거) |
| `app.json`(expo config) | `userInterfaceStyle: "automatic"` → `"light"` |

**이 단계가 건드리지 않는 것**(= 다음 단계로 이월):
- `themed-text`/`themed-view`/`use-theme`의 새 토큰 이관 — 공용 컴포넌트 단계에서 (지금은 레거시 토큰 위에서 그대로 동작).
- scaffold 데모(`animated-icon`·`app-tabs`·`hint-row`·`web-badge`·`explore.tsx`·`index.tsx`) 제거 및 레거시 export 삭제 — 네비 뼈대 단계.
- 공용 컴포넌트 프리미티브(chip/meter/fab/list-row/switch/segmented/page-head), 폰트 파일 로딩 — 다음 단계.

## 5. 리스크 / 미결

- (다음 단계 이월) themed-text/view의 기존 variant 이름(`default`/`title`/`subtitle`/`link`…)과 새 11단계 토큰 이름이 1:1이 아니다. 공용 컴포넌트 단계에서 **variant→토큰 매핑**을 정할 때, 매핑이 애매하면 가장 가까운 단계로 흡수한다(DESIGN.md "표 밖 크기 새로 만들지 않음" 원칙).
- 폰트 미로딩 상태에서 시스템 폰트 폴백으로 보이는 건 정상 — 이 단계의 완료 판정은 "토큰 정의 + 컴파일 그린"까지이며 시각 확인은 폰트 로딩 이후로 미룬다.

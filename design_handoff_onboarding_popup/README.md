# Handoff: 시화 — 최초 접속 안내 팝업 (Onboarding Popup)

## Overview

시화 앱의 **읽기(책) 뷰**에 최초 1회만 표시되는 상호작용 안내 팝업입니다.  
사용자가 처음 접속했을 때 책 페이지의 조작 방법(스크롤·페이지 이동)을 SVG 일러스트와 범례로 설명하고, 확인 즉시 사라집니다.

> ⚠️ 이 폴더의 파일들은 **디자인 레퍼런스 프로토타입**입니다.  
> React + Babel 기반의 HTML 파일로 작성되었으며, 실제 프로덕션 코드베이스(React Native, Next.js, Swift 등)에 맞게 패턴과 라이브러리를 사용해 재구현해 주세요.

---

## Fidelity

**High-fidelity** — 색상, 타이포그래피, 간격, 애니메이션 모두 최종 디자인 기준입니다.  
컴포넌트를 재구현할 때 아래 토큰 값을 그대로 사용하세요.

---

## 두 가지 Variant

| variant | 사용 위치 | localStorage 키 | 특징 |
|---|---|---|---|
| `portrait` (기본) | 모바일 세로 읽기 뷰 | `sihwa_guide_seen` | 페이지 전체 스크롤 안내 |
| `landscape` | PC 가로 스프레드 뷰 | `sihwa_guide_seen_pc` | **중앙 스크롤 영역** 강조 |

두 variant는 **독립된 localStorage 키**를 사용합니다. 한쪽을 닫아도 다른 쪽은 영향받지 않습니다.

---

## 컴포넌트 구조

```
OnboardingPopup (variant)
 ├─ 백드롭 (전체 오버레이, 클릭 시 닫힘)
 └─ 카드
     ├─ 헤더 ("읽기 안내" / "이렇게 넘겨보세요")
     ├─ BookIllustration (variant에 따라 분기)
     │   ├─ BookIllustrationPortrait  — 양면 페이지 + 스크롤 화살표
     │   └─ BookIllustrationLandscape — 양면 페이지 + 중앙 점선 박스 강조
     ├─ 범례 목록 (Legend × 3~4)
     └─ "읽기 시작" 버튼
```

---

## 화면 명세

### 백드롭

| 속성 | 값 |
|---|---|
| position | `absolute`, `inset: 0` |
| z-index | `9999` |
| background | `rgba(30, 24, 14, 0.52)` |
| backdrop-filter | `blur(6px)` |
| 정렬 | `flex`, `align-items: center`, `justify-content: center` |
| 진입 애니메이션 | `opacity 0→1`, `0.42s ease` |
| 퇴장 애니메이션 | `opacity 1→0`, `0.38s ease` |

### 카드

| 속성 | 값 |
|---|---|
| background | `#fdf8f2` |
| border-radius | `16px` |
| padding | `32px 28px 24px` |
| width | `310px` (max-width: 92vw) |
| box-shadow | `0 20px 60px rgba(0,0,0,0.28)` |
| 진입 애니메이션 | `translateY(14px→0) + opacity 0→1`, `0.48s cubic-bezier(0.22,1,0.36,1)` |

### 헤더 텍스트

| 요소 | font-family | size | weight | color | letter-spacing |
|---|---|---|---|---|---|
| "읽기 안내" | Noto Serif KR | 15px | 500 | `#2a2318` | 0.08em |
| "이렇게 넘겨보세요" | Pretendard Variable | 11px | 300 | `#8a7a60` | 0.16em |

### SVG 일러스트

**공통 색상 팔레트**

| 역할 | 값 |
|---|---|
| 종이 색 | `#fdf4e7` |
| 텍스트 줄 | `#c4b090` |
| 스크롤 화살표 | `#c8a06a` |
| 이전/다음 화살표 | `#5a4e38` |
| 제목 라인 | `#8a7a60` |
| 척추(spine) | `#c4b090` |
| 페이지 테두리 | `#e0ceaa`, strokeWidth 0.5 |

**portrait variant** (`BookIllustrationPortrait`)  
- SVG 크기: `254 × 148`
- 좌/우 페이지 각각 `100 × 120`, 척추로 분리  
- 각 페이지 위/아래에 ↑↓ 화살표 (bob 애니메이션)  
- 좌측 가장자리에 ← 이전, 우측 가장자리에 → 다음 화살표  

**landscape variant** (`BookIllustrationLandscape`)  
- SVG 크기: `254 × 152`  
- 좌/우 페이지 각각 `106 × 116`  
- 각 페이지 상단 22px = 비스크롤 영역 (살짝 어둡게: `rgba(180,160,120,0.08)`)  
- **스크롤 가능 영역 강조 박스**:  
  - 페이지 inset `14px` 안쪽에 위치  
  - fill: `rgba(255,255,255,0.72)`, border: `#c8a06a 0.8px` **점선** (`strokeDasharray: 3,2.5`)  
  - border-radius: `3px`  
  - drop-shadow: `#c8a06a` 글로우 효과  
- 스크롤 화살표는 강조 박스 안에만 표시  
- "스크롤 영역" 레이블 텍스트 표시 (7px, `#c8a06a`)

### 화살표 애니메이션

```css
/* 아래 방향 bob */
@keyframes ob-arrow-bob-v {
  0%,100% { transform: translateY(0);  opacity: 0.55; }
  50%      { transform: translateY(5px); opacity: 1;   }
}
/* 위 방향 bob */
@keyframes ob-arrow-bob-vu {
  0%,100% { transform: translateY(0);   opacity: 0.55; }
  50%      { transform: translateY(-5px); opacity: 1;   }
}
/* 오른쪽 bob */
@keyframes ob-arrow-bob-h {
  0%,100% { transform: translateX(0);  opacity: 0.55; }
  50%      { transform: translateX(4px); opacity: 1;   }
}
/* 왼쪽 bob */
@keyframes ob-arrow-bob-hl {
  0%,100% { transform: translateX(0);   opacity: 0.55; }
  50%      { transform: translateX(-4px); opacity: 1;   }
}
```

| 클래스 | 애니메이션 | duration | delay |
|---|---|---|---|
| `.ob-arrow-down` | `ob-arrow-bob-v` | 1.4s | 0s |
| `.ob-arrow-up` | `ob-arrow-bob-vu` | 1.4s | 0.2s |
| `.ob-arrow-right` | `ob-arrow-bob-h` | 1.3s | 0.1s |
| `.ob-arrow-left` | `ob-arrow-bob-hl` | 1.3s | 0.3s |

### 범례 (Legend)

각 항목: `flex, gap: 7px`

| 요소 | font-family | size | color |
|---|---|---|---|
| 아이콘 | monospace | 13px | `#c8a06a` |
| 텍스트 | Pretendard Variable | 10.5px, weight 300 | `#5a4e38` |

**portrait 범례 (2열 그리드)**
- ↕ 시 안에서 위아래 스크롤
- → 다음 시로 이동
- ← 이전 시로 이동
- ↔ 좌우 스와이프도 가능

**landscape 범례 (1열)**
- ↕ 각 페이지 중앙 영역(흰 박스)에서만 스크롤 가능합니다
- → 오른쪽 가장자리 탭 또는 다음 → 버튼으로 다음 시 이동
- ← 왼쪽 가장자리 탭 또는 ← 이전 버튼으로 이전 시 이동

### "읽기 시작" 버튼

| 속성 | 값 |
|---|---|
| background | `#3a2e1e` |
| color | `#fdf8f2` |
| font-size | 12px, weight 400 |
| letter-spacing | 0.18em |
| border-radius | 24px |
| padding | `11px 36px` |
| width | 100% |

### 하단 안내 문구

`"화면을 탭해도 닫힙니다"` — 10px, `#b09a7a`, letter-spacing 0.1em, margin-top 12px

---

## 상태 관리 및 동작

### 마운트 시 체크

```js
// portrait
const seen = localStorage.getItem('sihwa_guide_seen');
if (!seen) setVisible(true);

// landscape
const seen = localStorage.getItem('sihwa_guide_seen_pc');
if (!seen) setVisible(true);
```

### 닫기 흐름

1. `exiting = true` → 퇴장 애니메이션 시작 (`0.38s`)
2. `setTimeout 380ms` 후:
   - `localStorage.setItem(key, '1')` 저장
   - `visible = false` → 컴포넌트 언마운트
   - `onDismiss?.()` 콜백 호출 (선택)

### 닫기 트리거

- "읽기 시작" 버튼 클릭
- 백드롭(카드 바깥) 클릭

---

## 통합 위치

### 모바일 세로 뷰

`SihwaFull` 컴포넌트의 루트 div 안, **최상위 자식**으로 추가:

```jsx
// sihwa-full.jsx (또는 동등한 읽기 뷰 컴포넌트)
<div className="sf-root" style={{ position: 'relative' }}>
  <OnboardingPopup />          {/* ← 여기 추가 */}
  <SihwaTopBar ... />
  <div className="sf-body">
    ...
  </div>
</div>
```

> 부모 컨테이너에 반드시 `position: relative` (또는 `absolute/fixed`)가 있어야  
> 팝업의 `position: absolute; inset: 0`이 정확히 동작합니다.

### PC 가로 스프레드 뷰

`LandscapeSpread`(또는 동등한 가로 읽기 컴포넌트)를 `position: relative` 래퍼로 감싸고 팝업을 형제 노드로 추가:

```jsx
// app.jsx
function LandscapeSpread({ ... }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <LandscapeFrame ...>
        ...
      </LandscapeFrame>
      <OnboardingPopup variant="landscape" />   {/* ← 여기 추가 */}
    </div>
  );
}
```

---

## 디자인 토큰

```js
const tokens = {
  // 배경
  backdropBg:    'rgba(30, 24, 14, 0.52)',
  cardBg:        '#fdf8f2',

  // 잉크 계열
  inkDark:       '#2a2318',
  inkMid:        '#8a7a60',
  inkLight:      '#b09a7a',
  inkAccent:     '#c8a06a',
  inkDeep:       '#5a4e38',
  inkButton:     '#3a2e1e',

  // 애니메이션
  fadeInDur:     '0.42s',
  fadeOutDur:    '0.38s',
  cardInDur:     '0.48s',
  cardInEasing:  'cubic-bezier(0.22, 1, 0.36, 1)',
  arrowBobDur:   '1.4s',
};
```

---

## 재사용 팁

- 팝업 자체는 **앱 뷰와 독립적**입니다. `variant` prop 하나로 두 케이스를 처리하므로, 새로운 뷰가 추가될 경우 `variant`와 localStorage 키를 추가하는 방식으로 확장 가능합니다.
- 다시 표시하려면: `localStorage.removeItem('sihwa_guide_seen')` 또는 `localStorage.removeItem('sihwa_guide_seen_pc')` 실행 후 새로고침.

---

## 참고 파일

| 파일 | 설명 |
|---|---|
| `onboarding-popup.jsx` | 팝업 컴포넌트 전체 소스 (이 폴더 안에 포함) |
| `sihwa-full.jsx` | 모바일 뷰 통합 위치 |
| `app.jsx` | PC 가로 스프레드 통합 위치 |

# Handoff: 시화 — 책 페이지 넘김 UX

## Overview

공동시집 프로젝트 **시화(詩和)**의 차례(TOC)와 읽기(리더) 뷰를 실제 책처럼 3D 종이 넘김 애니메이션으로 구현하는 작업입니다. 기존 `SihwaApp.tsx`의 scroll/page 카드 뷰를 대체합니다.

- **대상 코드베이스**: `sihwa/sihwa/` — Next.js 14 · TypeScript · Firebase · Tailwind CSS
- **기존 메인 컴포넌트**: `app/components/SihwaApp.tsx`

## About the Design Files

이 폴더의 HTML/JSX/CSS 파일들은 **디자인 레퍼런스** 입니다. 프로덕션 코드로 그대로 복사하지 마세요. 목표는 이 디자인을 기존 Next.js 코드베이스의 패턴·라이브러리를 사용해 재구현하는 것입니다. TypeScript, Next.js의 기존 Firebase 연동(`lib/firebase.ts`), Tailwind 유틸리티를 우선 활용하세요.

## Fidelity

**High-fidelity** — 픽셀 수준의 명세입니다. 색상·폰트·간격·인터랙션 모두 명세를 따라 주세요.

---

## Design Tokens

### 색상 (Variant A — 백)
```
--paper:      #ffffff    (페이지 배경)
--paper-2:    #f8f8f8    (보조 배경)
--paper-edge: #e4e4e4    (책 옆면 색)
--ink:        #111111    (주 텍스트)
--ink-mid:    #555555    (본문 텍스트)
--ink-lite:   #aaaaaa    (보조 텍스트, 레이블)
--spine:      #cccccc    (구분선, 룰)
--border:     #e8e8e8    (테두리)
--shadow:     rgba(0,0,0,0.08)

섹션 구분 대형 글자: #ebebeb  (weight 100, 130px, 매우 연한 회색)
```

### 폰트
```
Primary: 'Pretendard Variable'
Fallback: 'Noto Sans KR', sans-serif
CDN: https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css
```

### 폰트 스케일 (내지 페이지)
| 용도 | 크기 | 굵기 | 자간 |
|---|---|---|---|
| 분기/회차 대형 제목 | 130px | 100 | -0.02em |
| 시 제목 | 21px (single) / 16px (spread) | 400 | 0.02em |
| 시 본문 | 13.5px (single) / 11.5px (spread) | 200 | 0.01em |
| 시인 이름 | 8.5px | 200 | 0.60em |
| 소형 레이블 | 9px | 200 | 0.52–0.64em |
| TOC 항목 | 12.5px | 300 | — |

### 행간 (Line Height)
- 시 본문 (single): `3.0`
- 시 본문 (spread): `2.4`
- TOC: `1.8`

---

## 구현할 핵심 컴포넌트

### 1. Book (책 뷰어)

**역할**: 페이지 배열을 받아 3D 종이 컬 애니메이션으로 넘기는 핵심 컴포넌트

**두 가지 모드**:
- `single` — 세로(portrait), 한 페이지씩
- `spread` — 가로(landscape), 양면 스프레드

**페이지 넘김 인터랙션**:
- 좌/우 가장자리 탭 (28% 너비 영역)
- 하단 이전/다음 버튼
- 키보드 ← → (마지막 포커스된 뷰어)
- 수평 스와이프 (터치)

**3D 애니메이션 핵심 CSS**:
```css
/* perspective는 부모 stage에 */
.book-stage {
  perspective: 2200px;
  perspective-origin: center center;
}

/* 넘기는 페이지 */
.flip-sheet {
  position: absolute;
  transform-style: preserve-3d;
  transition: transform 800ms cubic-bezier(0.42, 0.05, 0.4, 1);
  will-change: transform;
}

/* spread 모드: 오른쪽 절반, 왼쪽 엣지(척추)를 축으로 회전 */
.flip-spread {
  right: 0; width: 50%;
  transform-origin: left center;
}

/* single 모드: 전체 너비, 왼쪽 엣지를 축으로 회전 */
.flip-single {
  left: 0; right: 0;
  transform-origin: left center;
}

/* 앞면/뒷면 */
.flip-face { backface-visibility: hidden; }
.flip-back  { transform: rotateY(180deg); }

/* 컬 그림자 그라디언트 */
.flip-shade-front {
  background: linear-gradient(to right, rgba(80,55,20,0.28) 0%, rgba(80,55,20,0) 30%);
}
```

**Forward (다음) 애니메이션 상태**:
```
배경-좌: 현재 왼쪽 페이지 (spread) 또는 없음 (single)
배경-우: 다음 오른쪽 페이지 (또는 다음 페이지)
뒤집히는 시트:
  - 앞면: 현재 오른쪽 페이지 (또는 현재 페이지)
  - 뒷면: 다음 왼쪽 페이지 (또는 빈 종이)
  - transform: rotateY(0deg) → rotateY(-180deg)
```

**Backward (이전) 애니메이션 상태**:
```
위와 반대 — rotateY(-180deg) → rotateY(0deg)
```

**blank 페이지 자동 건너뜀** (single 모드):
```ts
// 앞/뒤 표지 사이 면지(blank) 페이지는 single 모드에서 스킵
while (pages[target]?.type === 'blank') target++;
```

**Props**:
```ts
interface BookProps {
  pages: PageItem[];        // buildBookPages() 결과
  mode: 'single' | 'spread';
  initialIdx?: number;      // 시작 페이지 인덱스
  forcedIdx?: number;       // 외부에서 강제 점프 (TOC 클릭 등)
  onIdxChange?: (idx: number) => void;
  flipDuration?: number;    // 기본 800ms
  showBookmark?: boolean;
}
```

---

### 2. 페이지 데이터 모델 (`buildBookPages`)

**page item 타입**:
```ts
type PageType =
  | 'front-cover' | 'back-cover' | 'blank'
  | 'title-page' | 'copyright'
  | 'toc-title' | 'toc-quarter'
  | 'quarter-divider' | 'quarter-intro'
  | 'round-divider'
  | 'poem' | 'free-poem' | 'free-divider'
  | 'end' | 'colophon';

interface PageItem {
  type: PageType;
  poem?: Poem;
  freePoem?: FreePoem;
  round?: Round;
  quarter?: Quarter;
  qi?: number;
  pageNum?: number;    // 콘텐츠 페이지 아라비아 번호
  bodyChunk?: string;  // 페이지네이션된 본문 조각
  chunkIdx?: number;   // 0 = 첫 페이지 (제목/시인 헤더 표시)
  totalChunks?: number;
}
```

**페이지 순서**:
```
pre-cover (blank) → front-cover → blank → title-page → copyright
→ toc-title → (분기별) toc-quarter
→ (분기별) quarter-divider → (quarter.intro가 있으면) quarter-intro
  → (회차별) round-divider → (시별 + 페이지네이션) poem
  → (자유시가 있으면) free-divider → free-poem
→ end → colophon → blank → back-cover
```

**페이지네이션** (stanza-aware):
```ts
// 연(stanza) 경계를 절대 쪼개지 않음
// \n\n 으로 연 분리, \n으로 줄 분리
// greedy packing: 연 단위로 maxLines까지 채움
function paginateBody(body: string, opts: {
  maxFirst: number;  // 첫 페이지 (제목 헤더 공간 제외): single=14, spread=4
  maxCont: number;   // 이후 페이지: single=20, spread=6
  chars: number;     // 줄당 평균 글자 수 (줄바꿈 추정): single=22, spread=20
}): string[]
```

---

### 3. 페이지 렌더러 (PageContent)

각 PageType별 렌더 컴포넌트. 주요 디자인 특성:

**시 본문 페이지 (poem)**:
```
레이아웃 (single):
  padding-top: 18%  (여백 — 아래에서 시작 않고 위 1/5 내려와 시작)
  순서: 시인이름(8.5px, #aaa, 0.60em spacing) → 제목(21px, 400) → 룰(14px, 0.5px) → 본문

레이아웃 (spread):
  padding-top: 0  (compact)
  제목: 16px
  본문: 11.5px / 2.4lh
```

**분기/회차 구분 페이지**:
```
레이아웃:
  padding-top: 13%에서 시작
  순서: 소형레이블(9px, #aaa, 0.56em) → 대형제목(130px/60px spread, #ebebeb, weight 100) → 룰(20px, 1px, #111)
```

**표지 페이지 (front-cover, back-cover)**:
```
CoverContext에서 이미지 URL 가져옴
이미지가 있으면 object-fit: cover로 전체 표시
없으면 플레이스홀더
```

---

### 4. 내비게이션 구조 (SihwaFull)

**뷰 상태**: `'cover' | 'toc' | 'book' | 'gallery' | 'edit'`

**라우팅 규칙**:
- `차례` 탭 → TOC 첫 페이지로 점프 (`toc-title` 타입의 pageIdx)
- `읽기` 탭 → 마지막 읽던 위치 유지 (`bookIdx` state)
- TOC 항목 클릭 → 해당 시의 첫 chunk로 점프 + `'book'` 뷰로 전환
- `갤러리` 탭 → GalleryView
- `편집` 탭 → 비밀번호 확인 후 EditView

**모드 전환** (portrait ↔ landscape):
```ts
// window.matchMedia로 회전 감지
const mql = window.matchMedia('(orientation: landscape)');
mql.addEventListener('change', (e) => {
  setMode(e.matches ? 'spread' : 'single');
});
```

---

### 5. 표지 이미지 관리 (CoverContext)

```ts
interface CoverContextValue {
  app:   string;  // 앱 홈 화면 배경 이미지 data URL 또는 ''
  front: string;  // 앞표지 이미지
  back:  string;  // 뒷표지 이미지
  set: (key: 'app' | 'front' | 'back', url: string) => void;
}
```

**저장**: `localStorage` 키 `sihwa_cover_app`, `sihwa_cover_front`, `sihwa_cover_back`

**실시간 반영**: React Context를 통해 커버 화면 + 책 첫/끝 페이지에 동시 반영

---

### 6. 책 물리 요소 (chrome)

| 요소 | 구현 방법 |
|---|---|
| **책 옆면 두께** | 오른쪽 4px repeating-gradient 바 (`opacity: 1 - readFraction`) |
| **러닝 헤더** | 현재 페이지의 `quarter.title`, 상단 26px |
| **페이지 번호** | 하단 모서리, font-size 9.5px, color #aaa |
| **가름끈(북마크)** | 우상단 14px 리본, 탭=토글, 더블탭=해당 페이지로 이동 |

---

## 기존 코드와의 통합 포인트

### `SihwaApp.tsx`에서 변경할 뷰

```tsx
// 현재 (제거할 것):
<div id="toc-view">...</div>      // 일반 리스트
<div id="book-view">...</div>     // 스크롤 뷰
<div id="page-view">...</div>     // 카드 뷰

// 대체 (새로 구현):
<BookViewer
  quarters={quarters}
  rounds={rounds}
  poems={poems}
  freePoems={freePoems}
  mode={orientation === 'landscape' ? 'spread' : 'single'}
  view={currentView}  // 'toc' | 'book'
  onViewChange={setCurrentView}
/>
```

### Firebase 데이터와 페이지 빌더 연결

```ts
// 기존 데이터 로드 후:
const pages = buildBookPages({ quarters, rounds, poems, freePoems });
// single/spread 별로 각각 빌드
const pagesSingle = buildBookPages(data, { maxFirst: 14, maxCont: 20, chars: 22 });
const pagesSpread = buildBookPages(data, { maxFirst: 4, maxCont: 6, chars: 20 });
```

### 뷰 토글 (기존 viewMode 대체)

기존 `viewMode: 'scroll' | 'page'` → 제거  
기존 view toggle 버튼(`스크롤`, `페이지`) → 제거  
자동 회전 감지 + 수동 토글 버튼 (선택)으로 대체

---

## 화면 / 뷰 목록

| 화면 | 파일 참고 | 설명 |
|---|---|---|
| 홈/표지 | `sihwa-full.jsx` (cover view) | image-slot 배경 + 하단 유리 버튼 |
| 차례 | `book-pages.jsx` (TocTitle, TocQuarter) | 책 형식 TOC |
| 읽기 — 단면 | `book.jsx` mode=single | portrait 3D flip |
| 읽기 — 양면 | `book.jsx` mode=spread | landscape 3D flip |
| 갤러리 | `gallery-view.jsx` (GalleryView) | 분기별 그리드 + 라이트박스 |
| 편집 | `gallery-view.jsx` (EditView) | 분기/회차/시/표지 관리 |

---

## 파일 목록

| 파일 | 역할 |
|---|---|
| `시화 책 페이지 넘김.html` | **메인 인터랙티브 프로토타입** (가장 중요) |
| `시화 북 디자인 탐색.html` | 내지 디자인 4개 방향 탐색 (A/B/C/D) |
| `book.jsx` | Book 컴포넌트 (3D flip 로직) |
| `book-pages.jsx` | 페이지 타입별 렌더러 |
| `book-data.jsx` | 페이지 빌더 + 페이지네이션 알고리즘 |
| `book.css` | 모든 디자인 토큰 + 스타일 |
| `sihwa-full.jsx` | 전체 앱 래퍼 (TopBar + 뷰 라우팅) |
| `gallery-view.jsx` | GalleryView + EditView + CoverTab |
| `cover-context.jsx` | React Context for cover images |
| `landscape-frame.jsx` | 가로 iPhone 베젤 (참고용) |

---

## 주의사항

1. **Pretendard 폰트 필수** — 기존 `Noto Serif KR` 기반 스타일과 완전히 교체
2. **스프레드 높이 제약** — landscape iPhone은 가용 콘텐츠 높이 ~240px. 시 본문 font-size 11.5px, line-height 2.4로 고정
3. **blank 페이지** — spread 모드에서 spreads를 짝수로 맞추기 위해 필요. single 모드에서 자동 스킵
4. **가름끈 bookmark** — localStorage에 페이지 인덱스 저장, 더블탭으로 복귀
5. **표지 이미지** — data URL로 localStorage 저장. 실제 앱에서는 Firebase Storage 업로드로 대체 권장

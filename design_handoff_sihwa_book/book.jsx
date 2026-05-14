// Book.jsx — page-turning book reader with realistic 3D paper curl.
//
// Two modes:
//   • 'single' (portrait)   — one page at a time. Spine pinned to the left
//                              edge of the device; pages curl leftward.
//   • 'spread' (landscape)  — two-up spread, spine down the middle.
//                              Right page rotates around the centre spine.
//
// Page model: an array of descriptors (see book-data.jsx) rendered through
// PageContent.jsx. Each book instance owns its own page index. Animation is
// driven by a `phase` state ('idle' | 'forward' | 'backward') + CSS
// transition on `transform`; transitionEnd flips to idle and commits the
// new index. Sequential clicks during a flip are queued (one ahead).
//
// Interactions: tap left/right edge zone, bottom nav prev/next, ←/→ keys,
// horizontal swipe. The active book registers a global key listener (one
// at a time — first active wins via a module-level token).

const { useState, useEffect, useRef, useCallback } = React;

// One global "active" book — whichever was last focused/tapped owns the
// keyboard. Prevents both prototypes from reacting to ←/→ simultaneously.
let __activeBookId = null;
let __nextBookId = 1;

function Book({
  pages,
  mode = 'single',           // 'single' | 'spread'
  initialIdx,
  forcedIdx,                 // when set by parent, jump without animation
  onIdxChange,               // callback(newIdx) whenever idx changes
  flipDuration = 800,        // ms
  paperTone = 'cream',       // 'cream' | 'warm' | 'aged'
  showBookmark = true,
}) {
  const isSpread = mode === 'spread';
  const step = isSpread ? 2 : 1;

  // Index meaning:
  //   single:  current page index in `pages`
  //   spread:  left page index (even). Right is idx+1.
  const startIdx = (() => {
    if (initialIdx != null) return initialIdx;
    return isSpread ? 0 : 1; // skip the pre-cover blank in single mode
  })();
  const [idx, setIdx] = useState(startIdx);

  // Animation phase.
  const [phase, setPhase] = useState('idle');
  // The index we're transitioning TO. Set when phase changes from idle.
  const targetRef = useRef(idx);

  // Bookmark state — saved page index, toggled with the ribbon icon.
  const [bookmark, setBookmark] = useState(null);

  // Unique id for this book (claims keyboard focus).
  const idRef = useRef(__nextBookId++);

  const total = pages.length;
  // Notify parent when idx changes.
  const prevIdxRef = useRef(idx);
  useEffect(() => {
    if (idx !== prevIdxRef.current) {
      prevIdxRef.current = idx;
      onIdxChange?.(idx);
    }
  }, [idx, onIdxChange]);

  // Respond to external forced jumps (e.g. TOC tap → reading position).
  useEffect(() => {
    if (forcedIdx != null && forcedIdx !== idx && phase === 'idle') {
      setIdx(forcedIdx);
      prevIdxRef.current = forcedIdx;
    }
  }, [forcedIdx]); // intentionally limited to forcedIdx changes only
  const atStart = idx <= (isSpread ? 0 : 1);
  const atEnd   = idx >= total - step;

  const goNext = useCallback(() => {
    if (phase !== 'idle') return;
    if (atEnd) return;
    let target = idx + step;
    // Single mode: auto-skip blank pages so the reader doesn't have to
    // tap through verso-of-cover and similar layout fillers.
    if (!isSpread) {
      while (target < total - 1 && pages[target] && pages[target].type === 'blank') target++;
    }
    if (target >= total) return;
    targetRef.current = target;
    setPhase('forward');
  }, [phase, atEnd, idx, step, isSpread, pages, total]);

  const goPrev = useCallback(() => {
    if (phase !== 'idle') return;
    if (atStart) return;
    let target = idx - step;
    if (!isSpread) {
      while (target > 0 && pages[target] && pages[target].type === 'blank') target--;
    }
    if (target < 0) return;
    targetRef.current = target;
    setPhase('backward');
  }, [phase, atStart, idx, step, isSpread, pages]);

  const onFlipEnd = () => {
    setIdx(targetRef.current);
    setPhase('idle');
  };

  // Claim keyboard whenever the book is interacted with.
  const claim = () => { __activeBookId = idRef.current; };

  useEffect(() => {
    const onKey = (e) => {
      if (__activeBookId !== idRef.current) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  // Swipe gesture (horizontal).
  const swipe = useRef({ x: null, y: null });
  const onTouchStart = (e) => {
    claim();
    const t = e.touches?.[0] || e;
    swipe.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const start = swipe.current;
    if (start.x == null) return;
    const t = e.changedTouches?.[0] || e;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    swipe.current = { x: null, y: null };
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) goNext(); else goPrev();
    }
  };

  // Compute which page descriptor goes where in each render state.
  // Pages outside the range render as null (BlankPage equivalent).
  const safe = (i) => (i >= 0 && i < total ? pages[i] : null);

  // For SPREAD mode:
  //   idle:  L=pages[idx], R=pages[idx+1]
  //   forward (idx → idx+2):
  //     bgL=pages[idx]   bgR=pages[idx+3]
  //     flip: front=pages[idx+1] back=pages[idx+2]   (rotateY 0 → -180)
  //   backward (idx → idx-2):
  //     bgL=pages[idx-2] bgR=pages[idx+1]
  //     flip: front=pages[idx-1] back=pages[idx]     (rotateY -180 → 0)
  //
  // For SINGLE mode (only "right" half is used, full width):
  //   idle:  page=pages[idx]
  //   forward (idx → idx+1):
  //     bg=pages[idx+1]
  //     flip: front=pages[idx] back=BLANK            (rotateY 0 → -180)
  //   backward (idx → idx-1):
  //     bg=pages[idx]  (still showing current; new comes in over)
  //     flip: front=pages[idx-1] back=BLANK          (rotateY -180 → 0)
  //
  // Note: in single backward, bg = pages[idx] (current) — the flipping page
  // sweeps in from the left and covers it as rotateY approaches 0. At
  // transitionEnd we commit idx = idx-1 so bg becomes the new page in sync.

  let bgL, bgR, flipFront, flipBack, flipFromR, flipToR;
  if (isSpread) {
    if (phase === 'idle') {
      bgL = safe(idx);
      bgR = safe(idx + 1);
    } else if (phase === 'forward') {
      bgL = safe(idx);
      bgR = safe(idx + 3);
      flipFront = safe(idx + 1);
      flipBack  = safe(idx + 2);
      flipFromR = 0; flipToR = -180;
    } else {
      bgL = safe(idx - 2);
      bgR = safe(idx + 1);
      flipFront = safe(idx - 1);
      flipBack  = safe(idx);
      flipFromR = -180; flipToR = 0;
    }
  } else {
    if (phase === 'idle') {
      bgR = safe(idx);
    } else if (phase === 'forward') {
      bgR = safe(idx + 1);
      flipFront = safe(idx);
      flipBack  = null;
      flipFromR = 0; flipToR = -180;
    } else {
      bgR = safe(idx);
      flipFront = safe(idx - 1);
      flipBack  = null;
      flipFromR = -180; flipToR = 0;
    }
  }

  // Apply transform when phase active. We render at flipFromR for one frame,
  // then trigger transition to flipToR via requestAnimationFrame.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (phase === 'idle') { setArmed(false); return; }
    // arm on next frame to ensure the FROM transform is committed first
    const a = requestAnimationFrame(() => {
      requestAnimationFrame(() => setArmed(true));
    });
    return () => cancelAnimationFrame(a);
  }, [phase]);

  const flipRotate = phase === 'idle' ? 0 : (armed ? flipToR : flipFromR);

  // Quarter running header for the visible page(s).
  const currentVisibleForHeader = isSpread
    ? (pages[idx + 1] || pages[idx])
    : pages[idx];
  const quarterLabel = quarterContextFor(currentVisibleForHeader);

  // Page-number display for footer corners.
  const leftPageNum  = isSpread ? (pages[idx]?.pageNum || '')   : '';
  const rightPageNum = isSpread ? (pages[idx+1]?.pageNum || '') : (pages[idx]?.pageNum || '');

  // Pages remaining — used to draw the side-edge "thickness" of the book.
  const readFraction = idx / Math.max(1, total - step);

  const onBookmark = (e) => {
    e.stopPropagation();
    claim();
    setBookmark(bm => bm === idx ? null : idx);
  };
  const jumpToBookmark = () => {
    if (bookmark == null) return;
    if (phase !== 'idle') return;
    setIdx(bookmark);
  };

  return (
    <div
      className={`book-root paper-${paperTone} mode-${mode}`}
      style={{ '--flip-dur': `${flipDuration}ms` }}
      onMouseDownCapture={claim}
      onTouchStartCapture={claim}
    >
      {/* book physical edges (closed-book thickness on the unread side) */}
      <div className="book-edge book-edge-right" style={{ '--read': readFraction }} />
      <div className="book-edge book-edge-left"  style={{ '--read': readFraction }} />

      {/* running header (quarter name) */}
      <div className="book-header">
        {quarterLabel && <span className="book-header-text">{quarterLabel}</span>}
      </div>

      {/* bookmark ribbon */}
      {showBookmark && (
        <div
          className={`book-ribbon${bookmark != null ? ' active' : ''}`}
          onClick={onBookmark}
          onDoubleClick={jumpToBookmark}
          title={bookmark != null ? '북마크 (더블탭: 이동, 탭: 해제)' : '북마크 추가'}
        >
          <div className="book-ribbon-tail" />
        </div>
      )}

      {/* page stage */}
      <div
        className="book-stage"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* background pages (the ones already in place under the flipping sheet) */}
        {isSpread && (
          <div className="bg-page bg-left">
            <PageInner page={bgL} side="left" totalPages={total} />
          </div>
        )}
        <div className={`bg-page${isSpread ? ' bg-right' : ' bg-single'}`}>
          <PageInner page={bgR} side={isSpread ? 'right' : 'single'} totalPages={total} />
        </div>

        {/* spine shadow (spread only) */}
        {isSpread && <div className="book-spine" />}

        {/* flipping sheet — only present during forward/backward */}
        {phase !== 'idle' && (
          <div
            className={`flip-sheet ${isSpread ? 'flip-spread' : 'flip-single'} ${phase}`}
            style={{ transform: `rotateY(${flipRotate}deg)` }}
            onTransitionEnd={(e) => {
              if (e.propertyName === 'transform') onFlipEnd();
            }}
          >
            <div className="flip-face flip-front">
              <PageInner page={flipFront} side={isSpread ? 'right' : 'single'} totalPages={total} />
              <div className="flip-shade flip-shade-front" />
            </div>
            <div className="flip-face flip-back">
              <PageInner page={flipBack}  side={isSpread ? 'left'  : 'single'} totalPages={total} />
              <div className="flip-shade flip-shade-back" />
            </div>
          </div>
        )}

        {/* tap zones */}
        <button className="tap-zone tap-prev" onClick={goPrev} disabled={atStart} aria-label="이전 페이지" />
        <button className="tap-zone tap-next" onClick={goNext} disabled={atEnd}   aria-label="다음 페이지" />
      </div>

      {/* page numbers in outer corners */}
      <div className="page-foot">
        <span className="page-num page-num-l">{leftPageNum}</span>
        <span className="page-num page-num-r">{rightPageNum}</span>
      </div>

      {/* bottom nav */}
      <div className="book-nav">
        <button className="nav-btn" onClick={goPrev} disabled={atStart || phase !== 'idle'}>← 이전</button>
        <div className="nav-indicator">
          {(() => {
            if (isSpread) {
              const l = pages[idx]?.pageNum, r = pages[idx+1]?.pageNum;
              const both = [l, r].filter(Boolean);
              if (both.length === 0) return labelForPage(pages[idx]) || labelForPage(pages[idx+1]) || '';
              return `${both.join('–')} / ${pages.filter(p=>p.pageNum).length}`;
            } else {
              const n = pages[idx]?.pageNum;
              if (!n) return labelForPage(pages[idx]) || '';
              return `${n} / ${pages.filter(p=>p.pageNum).length}`;
            }
          })()}
        </div>
        <button className="nav-btn" onClick={goNext} disabled={atEnd || phase !== 'idle'}>다음 →</button>
      </div>
    </div>
  );
}

// Page wrapper that adds inner padding + edge gutter relative to which side
// of the spread it's on. PageContent itself doesn't know about left/right.
function PageInner({ page, side, totalPages }) {
  return (
    <div className={`page-inner page-inner-${side}`}>
      <PageContent page={page} side={side} totalPages={totalPages} />
    </div>
  );
}

// Friendly label for the nav indicator when on an unnumbered page
// (front matter, dividers, etc).
function labelForPage(page) {
  if (!page) return '';
  switch (page.type) {
    case 'front-cover': return '표지';
    case 'half-title':  return '약식 표지';
    case 'title-page':  return '속표지';
    case 'copyright':   return '판권지';
    case 'toc-title':   return '차례';
    case 'toc-quarter': return `차례 — ${page.quarter.title}`;
    case 'quarter-divider': return `${page.qi + 1}분기 표지`;
    case 'quarter-intro':   return `${page.quarter.title} — 소개`;
    case 'round-divider':   return `${page.round.num}회차 — ${page.round.title}`;
    case 'free-divider':    return `자유시 — ${page.quarter.title}`;
    case 'end':         return '끝';
    case 'colophon':    return '판권';
    case 'back-cover':  return '뒷표지';
    default:            return '';
  }
}

Object.assign(window, { Book });

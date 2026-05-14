'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  CSSProperties,
  TouchEvent as ReactTouchEvent,
} from 'react'
import type { PageItem } from '@/lib/bookData'
import { quarterContextFor, labelForPage } from '@/lib/bookData'
import { PageContent, type BookSourceData } from './BookPages'

let __activeBookId: number | null = null
let __nextBookId = 1

type Phase = 'idle' | 'forward' | 'backward'

export interface BookProps {
  pages: PageItem[]
  mode: 'single' | 'spread'
  data: BookSourceData
  initialIdx?: number
  forcedIdx?: number
  forceJumpToken?: number
  onIdxChange?: (idx: number) => void
  flipDuration?: number
  paperTone?: 'cream' | 'warm' | 'aged'
  showBookmark?: boolean
}

export default function Book({
  pages,
  mode,
  data,
  initialIdx,
  forcedIdx,
  forceJumpToken,
  onIdxChange,
  flipDuration = 800,
  paperTone = 'cream',
  showBookmark = true,
}: BookProps) {
  const isSpread = mode === 'spread'
  const step = isSpread ? 2 : 1

  const startIdx = (() => {
    if (initialIdx != null) return initialIdx
    return isSpread ? 0 : 1
  })()
  const [idx, setIdx] = useState(startIdx)
  const [phase, setPhase] = useState<Phase>('idle')
  const targetRef = useRef<number>(idx)
  const [bookmark, setBookmark] = useState<number | null>(null)
  const idRef = useRef<number>(__nextBookId++)

  const total = pages.length

  const prevIdxRef = useRef<number>(idx)
  useEffect(() => {
    if (idx !== prevIdxRef.current) {
      prevIdxRef.current = idx
      onIdxChange?.(idx)
    }
  }, [idx, onIdxChange])

  // Snap to a valid landing idx for the active mode. Spread mode expects
  // an even idx (left page of a spread); odd targets snap to the prior even.
  const snapIdx = useCallback((i: number) => {
    if (isSpread) return Math.max(0, Math.floor(i / 2) * 2)
    return Math.max(0, i)
  }, [isSpread])

  // Forced-jump queue: if a jump arrives while flipping, hold it and apply
  // once phase returns to idle. Re-runs on either forcedIdx or
  // forceJumpToken so the parent can re-trigger the same target idx.
  const pendingJumpRef = useRef<number | null>(null)
  useEffect(() => {
    if (forcedIdx == null) return
    const target = snapIdx(forcedIdx)
    if (phase === 'idle') {
      if (target !== idx) {
        setIdx(target)
        prevIdxRef.current = target
      }
      pendingJumpRef.current = null
    } else {
      pendingJumpRef.current = target
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedIdx, forceJumpToken])

  const atStart = idx <= (isSpread ? 0 : 1)
  const atEnd = idx >= total - step

  const goNext = useCallback(() => {
    if (phase !== 'idle') return
    if (atEnd) return
    let target = idx + step
    if (!isSpread) {
      while (target < total - 1 && pages[target] && pages[target].type === 'blank') target++
    }
    if (target >= total) return
    targetRef.current = target
    setPhase('forward')
  }, [phase, atEnd, idx, step, isSpread, pages, total])

  const goPrev = useCallback(() => {
    if (phase !== 'idle') return
    if (atStart) return
    let target = idx - step
    if (!isSpread) {
      while (target > 0 && pages[target] && pages[target].type === 'blank') target--
    }
    if (target < 0) return
    targetRef.current = target
    setPhase('backward')
  }, [phase, atStart, idx, step, isSpread, pages])

  const flipSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onFlipEnd = useCallback(() => {
    if (flipSafetyTimerRef.current) {
      clearTimeout(flipSafetyTimerRef.current)
      flipSafetyTimerRef.current = null
    }
    setIdx(targetRef.current)
    setPhase('idle')
    // Flush any pending forced jump that arrived during the flip.
    const pending = pendingJumpRef.current
    if (pending != null && pending !== targetRef.current) {
      pendingJumpRef.current = null
      setIdx(pending)
      prevIdxRef.current = pending
    } else {
      pendingJumpRef.current = null
    }
  }, [])

  const claim = () => {
    __activeBookId = idRef.current
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (__activeBookId !== idRef.current) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // claim by default on mount so a freshly mounted book gets keys
  useEffect(() => {
    claim()
  }, [])

  const swipe = useRef<{ x: number | null; y: number | null }>({ x: null, y: null })
  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    claim()
    const t = e.touches?.[0]
    if (!t) return
    swipe.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = swipe.current
    if (start.x == null || start.y == null) return
    const t = e.changedTouches?.[0]
    if (!t) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    swipe.current = { x: null, y: null }
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) goNext()
      else goPrev()
    }
  }

  const safe = (i: number): PageItem | null => (i >= 0 && i < total ? pages[i] : null)

  let bgL: PageItem | null = null
  let bgR: PageItem | null = null
  let flipFront: PageItem | null = null
  let flipBack: PageItem | null = null
  let flipFromR = 0
  let flipToR = 0

  if (isSpread) {
    if (phase === 'idle') {
      bgL = safe(idx)
      bgR = safe(idx + 1)
    } else if (phase === 'forward') {
      bgL = safe(idx)
      bgR = safe(idx + 3)
      flipFront = safe(idx + 1)
      flipBack = safe(idx + 2)
      flipFromR = 0
      flipToR = -180
    } else {
      bgL = safe(idx - 2)
      bgR = safe(idx + 1)
      flipFront = safe(idx - 1)
      flipBack = safe(idx)
      flipFromR = -180
      flipToR = 0
    }
  } else {
    if (phase === 'idle') {
      bgR = safe(idx)
    } else if (phase === 'forward') {
      bgR = safe(idx + 1)
      flipFront = safe(idx)
      flipBack = null
      flipFromR = 0
      flipToR = -180
    } else {
      bgR = safe(idx)
      flipFront = safe(idx - 1)
      flipBack = null
      flipFromR = -180
      flipToR = 0
    }
  }

  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (phase === 'idle') {
      setArmed(false)
      return
    }
    const a = requestAnimationFrame(() => {
      requestAnimationFrame(() => setArmed(true))
    })
    // Safety: if transitionend never fires (tab suspended, unmount mid-flip,
    // CSS recalculated), force-settle so the viewer doesn't deadlock.
    flipSafetyTimerRef.current = setTimeout(() => {
      if (flipSafetyTimerRef.current) {
        flipSafetyTimerRef.current = null
        onFlipEnd()
      }
    }, flipDuration + 200)
    return () => {
      cancelAnimationFrame(a)
      if (flipSafetyTimerRef.current) {
        clearTimeout(flipSafetyTimerRef.current)
        flipSafetyTimerRef.current = null
      }
    }
  }, [phase, flipDuration, onFlipEnd])

  const flipRotate = phase === 'idle' ? 0 : armed ? flipToR : flipFromR

  const currentVisibleForHeader = isSpread ? pages[idx + 1] || pages[idx] : pages[idx]
  const quarterLabel = quarterContextFor(currentVisibleForHeader)

  const leftPageNum = isSpread ? pages[idx]?.pageNum || '' : ''
  const rightPageNum = isSpread ? pages[idx + 1]?.pageNum || '' : pages[idx]?.pageNum || ''

  const readFraction = idx / Math.max(1, total - step)

  const onBookmark = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    claim()
    setBookmark(bm => (bm === idx ? null : idx))
  }
  const jumpToBookmark = () => {
    if (bookmark == null) return
    if (phase !== 'idle') return
    setIdx(bookmark)
  }
  const onBookmarkKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onBookmark(e)
    } else if (e.key === ' ') {
      e.preventDefault()
      onBookmark(e)
    }
  }

  // aria-live label for screen readers — announces the current page label.
  const currentPageLabel = (() => {
    if (isSpread) {
      const l = pages[idx]?.pageNum
      const r = pages[idx + 1]?.pageNum
      const nums = [l, r].filter(Boolean).join('–')
      const lbl = labelForPage(pages[idx]) || labelForPage(pages[idx + 1])
      return nums ? `${nums}쪽` : lbl
    }
    const n = pages[idx]?.pageNum
    return n ? `${n}쪽` : labelForPage(pages[idx])
  })()

  const rootStyle = { '--flip-dur': `${flipDuration}ms` } as CSSProperties

  return (
    <div
      className={`book-root paper-${paperTone} mode-${mode}`}
      style={rootStyle}
      onMouseDownCapture={claim}
      onTouchStartCapture={claim}
    >
      <div
        className="book-edge book-edge-right"
        style={{ ['--read' as string]: readFraction } as CSSProperties}
      />
      <div
        className="book-edge book-edge-left"
        style={{ ['--read' as string]: readFraction } as CSSProperties}
      />

      <div className="book-header">
        {quarterLabel && <span className="book-header-text">{quarterLabel}</span>}
      </div>

      {showBookmark && (
        <div
          className={`book-ribbon${bookmark != null ? ' active' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={bookmark != null}
          aria-label={bookmark != null ? '북마크 해제 (더블탭으로 해당 페이지로 이동)' : '북마크 추가'}
          onClick={onBookmark}
          onDoubleClick={jumpToBookmark}
          onKeyDown={onBookmarkKey}
          title={bookmark != null ? '북마크 (더블탭: 이동, 탭: 해제)' : '북마크 추가'}
        >
          <div className="book-ribbon-tail" />
        </div>
      )}

      {/* SR-only live region announcing current page */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {currentPageLabel}
      </div>

      <div className="book-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {isSpread && (
          <div className="bg-page bg-left">
            <PageInner page={bgL} side="left" totalPages={total} data={data} />
          </div>
        )}
        <div className={`bg-page${isSpread ? ' bg-right' : ' bg-single'}`}>
          <PageInner page={bgR} side={isSpread ? 'right' : 'single'} totalPages={total} data={data} />
        </div>

        {isSpread && <div className="book-spine" />}

        {phase !== 'idle' && (
          <div
            className={`flip-sheet ${isSpread ? 'flip-spread' : 'flip-single'} ${phase}`}
            style={{ transform: `rotateY(${flipRotate}deg)` }}
            onTransitionEnd={e => {
              if (e.propertyName === 'transform') onFlipEnd()
            }}
          >
            <div className="flip-face flip-front">
              <PageInner
                page={flipFront}
                side={isSpread ? 'right' : 'single'}
                totalPages={total}
                data={data}
              />
              <div className="flip-shade flip-shade-front" />
            </div>
            <div className="flip-face flip-back">
              <PageInner
                page={flipBack}
                side={isSpread ? 'left' : 'single'}
                totalPages={total}
                data={data}
              />
              <div className="flip-shade flip-shade-back" />
            </div>
          </div>
        )}

        <button
          className="tap-zone tap-prev"
          onClick={goPrev}
          disabled={atStart}
          aria-label="이전 페이지"
        />
        <button
          className="tap-zone tap-next"
          onClick={goNext}
          disabled={atEnd}
          aria-label="다음 페이지"
        />
      </div>

      <div className="page-foot">
        <span className="page-num page-num-l">{leftPageNum}</span>
        <span className="page-num page-num-r">{rightPageNum}</span>
      </div>

      <div className="book-nav">
        <button className="nav-btn" onClick={goPrev} disabled={atStart || phase !== 'idle'}>
          ← 이전
        </button>
        <div className="nav-indicator">
          {(() => {
            if (isSpread) {
              const l = pages[idx]?.pageNum
              const r = pages[idx + 1]?.pageNum
              const both = [l, r].filter(Boolean)
              if (both.length === 0)
                return labelForPage(pages[idx]) || labelForPage(pages[idx + 1]) || ''
              return `${both.join('–')} / ${pages.filter(p => p.pageNum).length}`
            } else {
              const n = pages[idx]?.pageNum
              if (!n) return labelForPage(pages[idx]) || ''
              return `${n} / ${pages.filter(p => p.pageNum).length}`
            }
          })()}
        </div>
        <button className="nav-btn" onClick={goNext} disabled={atEnd || phase !== 'idle'}>
          다음 →
        </button>
      </div>
    </div>
  )
}

function PageInner({
  page,
  side,
  totalPages,
  data,
}: {
  page: PageItem | null
  side: 'left' | 'right' | 'single'
  totalPages: number
  data: BookSourceData
}) {
  return (
    <div className={`page-inner page-inner-${side}`}>
      <PageContent page={page} side={side} totalPages={totalPages} data={data} />
    </div>
  )
}

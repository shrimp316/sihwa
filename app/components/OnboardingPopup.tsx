'use client'

import { useState, useEffect, useRef } from 'react'

interface OnboardingPopupProps {
  variant?: 'portrait' | 'landscape'
  onDismiss?: () => void
}

function readSeen(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return !!window.localStorage.getItem(key)
  } catch {
    return false
  }
}

// ── 수직 화살표 ──────────────────────────────────────────────────────────────
function ArrowV({ x, y, dir, color }: { x: number; y: number; dir: 'up' | 'down'; color: string }) {
  const d = dir === 'down' ? 1 : -1
  const size = 7
  return (
    <g>
      <line x1={x} y1={y - d * size} x2={x} y2={y + d * size}
        stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.9"
      />
      <polyline
        points={`${x - 4},${y + d * (size - 4)} ${x},${y + d * size} ${x + 4},${y + d * (size - 4)}`}
        fill="none" stroke={color} strokeWidth="1.4"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.9"
      />
    </g>
  )
}

// ── 수평 화살표 ──────────────────────────────────────────────────────────────
function ArrowH({ x, y, dir, color }: { x: number; y: number; dir: 'left' | 'right'; color: string }) {
  const d = dir === 'right' ? 1 : -1
  const size = 8
  return (
    <g>
      <line x1={x - d * size} y1={y} x2={x + d * size} y2={y}
        stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.9"
      />
      <polyline
        points={`${x + d * (size - 4)},${y - 4} ${x + d * size},${y} ${x + d * (size - 4)},${y + 4}`}
        fill="none" stroke={color} strokeWidth="1.4"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.9"
      />
    </g>
  )
}

// ── 범례 아이템 ──────────────────────────────────────────────────────────────
function Legend({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
      <span style={{
        fontFamily: 'monospace', fontSize: 13,
        color: '#c8a06a', lineHeight: 1.3,
        flexShrink: 0, marginTop: 1,
      }}>{icon}</span>
      <span style={{
        fontFamily: "'Pretendard Variable','Noto Sans KR',sans-serif",
        fontSize: 10.5, fontWeight: 300,
        color: '#5a4e38', lineHeight: 1.5,
        letterSpacing: '0.04em',
      }}>{text}</span>
    </div>
  )
}

// ── Portrait 일러스트 ─────────────────────────────────────────────────────────
function BookIllustrationPortrait() {
  const W = 254, H = 148
  const pageW = 100, pageH = 120
  const spineX = W / 2
  const leftX = spineX - pageW - 2
  const rightX = spineX + 2
  const pY = (H - pageH) / 2

  const paper = '#fdf4e7'
  const arrowC = '#c8a06a'
  const navC = '#5a4e38'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W} height={H}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <filter id="ob-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.13" />
      </filter>

      {/* 왼쪽 페이지 */}
      <rect x={leftX} y={pY} width={pageW} height={pageH}
        fill={paper} rx={2}
        filter="url(#ob-shadow)"
        stroke="#e0ceaa" strokeWidth="0.5"
      />
      {[18, 30, 42, 54, 66, 84, 96, 108].map((dy, i) => (
        <line key={i}
          x1={leftX + 12} y1={pY + dy}
          x2={leftX + pageW - 16 - (i % 3 === 1 ? 18 : i % 3 === 2 ? 8 : 0)} y2={pY + dy}
          stroke="#c4b090" strokeWidth="0.8" opacity="0.6"
        />
      ))}

      {/* 오른쪽 페이지 */}
      <rect x={rightX} y={pY} width={pageW} height={pageH}
        fill={paper} rx={2}
        filter="url(#ob-shadow)"
        stroke="#e0ceaa" strokeWidth="0.5"
      />
      {[14, 24, 36, 48, 60, 72, 90, 102, 114].map((dy, i) => (
        <line key={i}
          x1={rightX + 12} y1={pY + dy}
          x2={rightX + pageW - 14 - (i % 4 === 1 ? 24 : i % 4 === 2 ? 10 : i % 4 === 3 ? 16 : 0)} y2={pY + dy}
          stroke="#c4b090" strokeWidth="0.8" opacity="0.6"
        />
      ))}

      {/* 제목 라인 (왼쪽) */}
      <line x1={leftX + 12} y1={pY + 10} x2={leftX + 52} y2={pY + 10}
        stroke="#8a7a60" strokeWidth="1.5" opacity="0.7"
      />

      {/* 척추 */}
      <line x1={spineX} y1={pY} x2={spineX} y2={pY + pageH}
        stroke="#c4b090" strokeWidth="1.2" opacity="0.6"
      />

      {/* 왼쪽 스크롤 화살표 위 */}
      <g className="ob-arrow-up" style={{ transformOrigin: `${leftX + pageW / 2}px ${pY + 28}px` }}>
        <ArrowV x={leftX + pageW / 2} y={pY + 28} dir="up" color={arrowC} />
      </g>

      {/* 왼쪽 스크롤 화살표 아래 */}
      <g className="ob-arrow-down" style={{ transformOrigin: `${leftX + pageW / 2}px ${pY + pageH - 22}px` }}>
        <ArrowV x={leftX + pageW / 2} y={pY + pageH - 22} dir="down" color={arrowC} />
      </g>

      {/* 오른쪽 스크롤 화살표 위 */}
      <g className="ob-arrow-up" style={{ transformOrigin: `${rightX + pageW / 2}px ${pY + 28}px` }}>
        <ArrowV x={rightX + pageW / 2} y={pY + 28} dir="up" color={arrowC} />
      </g>

      {/* 오른쪽 스크롤 화살표 아래 */}
      <g className="ob-arrow-down" style={{ transformOrigin: `${rightX + pageW / 2}px ${pY + pageH - 22}px` }}>
        <ArrowV x={rightX + pageW / 2} y={pY + pageH - 22} dir="down" color={arrowC} />
      </g>

      {/* 이전 화살표 */}
      <g className="ob-arrow-left" style={{ transformOrigin: `${leftX - 18}px ${H / 2}px` }}>
        <ArrowH x={leftX - 18} y={H / 2} dir="left" color={navC} />
        <text x={leftX - 14} y={H / 2 + 14}
          fill={navC} fontSize="8" fontFamily="'Pretendard Variable','Noto Sans KR',sans-serif"
          textAnchor="middle" letterSpacing="0.05em" opacity="0.8"
        >이전</text>
      </g>

      {/* 다음 화살표 */}
      <g className="ob-arrow-right" style={{ transformOrigin: `${rightX + pageW + 18}px ${H / 2}px` }}>
        <ArrowH x={rightX + pageW + 18} y={H / 2} dir="right" color={navC} />
        <text x={rightX + pageW + 14} y={H / 2 + 14}
          fill={navC} fontSize="8" fontFamily="'Pretendard Variable','Noto Sans KR',sans-serif"
          textAnchor="middle" letterSpacing="0.05em" opacity="0.8"
        >다음</text>
      </g>

      {/* 스크롤 레이블 */}
      <text x={leftX + pageW / 2} y={pY + pageH / 2 + 4}
        fill={arrowC} fontSize="7.5"
        fontFamily="'Pretendard Variable','Noto Sans KR',sans-serif"
        textAnchor="middle" letterSpacing="0.1em" opacity="0.75"
      >스크롤</text>
      <text x={rightX + pageW / 2} y={pY + pageH / 2 + 4}
        fill={arrowC} fontSize="7.5"
        fontFamily="'Pretendard Variable','Noto Sans KR',sans-serif"
        textAnchor="middle" letterSpacing="0.1em" opacity="0.75"
      >스크롤</text>
    </svg>
  )
}

// ── Landscape 일러스트 ────────────────────────────────────────────────────────
function BookIllustrationLandscape() {
  const W = 254, H = 152
  const pageW = 106, pageH = 116
  const spineX = W / 2
  const leftX = spineX - pageW - 2
  const rightX = spineX + 2
  const pY = (H - pageH) / 2

  const paper = '#fdf4e7'
  const arrowC = '#c8a06a'
  const navC = '#5a4e38'

  const zoneInset = 14
  const zoneX = (px: number) => px + zoneInset
  const zoneY = pY + 22
  const zoneW = pageW - zoneInset * 2
  const zoneH = pageH - 34

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}
      style={{ display: 'block', overflow: 'visible' }}>

      <defs>
        <filter id="ob-sh2">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.11" />
        </filter>
        <filter id="ob-glow">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#c8a06a" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* 왼쪽 페이지 */}
      <rect x={leftX} y={pY} width={pageW} height={pageH}
        fill={paper} rx={2} filter="url(#ob-sh2)"
        stroke="#e0ceaa" strokeWidth="0.5"
      />
      <rect x={leftX} y={pY} width={pageW} height={22}
        fill="rgba(180,160,120,0.08)" rx={2}
      />
      <line x1={leftX + 12} y1={pY + 11} x2={leftX + 54} y2={pY + 11}
        stroke="#8a7a60" strokeWidth="1.4" opacity="0.65"
      />
      <rect x={zoneX(leftX)} y={zoneY} width={zoneW} height={zoneH}
        fill="rgba(255,255,255,0.72)" rx={3}
        stroke="#c8a06a" strokeWidth="0.8" strokeDasharray="3,2.5"
        filter="url(#ob-glow)"
      />
      {[10, 20, 30, 42, 54, 64].map((dy, i) => (
        <line key={i}
          x1={zoneX(leftX) + 6} y1={zoneY + dy}
          x2={zoneX(leftX) + zoneW - 8 - (i % 3 === 1 ? 14 : i % 3 === 2 ? 6 : 0)} y2={zoneY + dy}
          stroke="#c4b090" strokeWidth="0.75" opacity="0.55"
        />
      ))}

      {/* 오른쪽 페이지 */}
      <rect x={rightX} y={pY} width={pageW} height={pageH}
        fill={paper} rx={2} filter="url(#ob-sh2)"
        stroke="#e0ceaa" strokeWidth="0.5"
      />
      <rect x={rightX} y={pY} width={pageW} height={22}
        fill="rgba(180,160,120,0.08)" rx={2}
      />
      <line x1={rightX + 12} y1={pY + 11} x2={rightX + 60} y2={pY + 11}
        stroke="#8a7a60" strokeWidth="1.4" opacity="0.65"
      />
      <rect x={zoneX(rightX)} y={zoneY} width={zoneW} height={zoneH}
        fill="rgba(255,255,255,0.72)" rx={3}
        stroke="#c8a06a" strokeWidth="0.8" strokeDasharray="3,2.5"
        filter="url(#ob-glow)"
      />
      {[10, 20, 30, 42, 54, 64, 76].map((dy, i) => (
        <line key={i}
          x1={zoneX(rightX) + 6} y1={zoneY + dy}
          x2={zoneX(rightX) + zoneW - 8 - (i % 4 === 1 ? 18 : i % 4 === 2 ? 8 : i % 4 === 3 ? 12 : 0)} y2={zoneY + dy}
          stroke="#c4b090" strokeWidth="0.75" opacity="0.55"
        />
      ))}

      {/* 척추 */}
      <line x1={spineX} y1={pY} x2={spineX} y2={pY + pageH}
        stroke="#c4b090" strokeWidth="1.1" opacity="0.55"
      />

      {/* 스크롤 화살표 */}
      <g className="ob-arrow-up" style={{ transformOrigin: `${zoneX(leftX) + zoneW / 2}px ${zoneY + 16}px` }}>
        <ArrowV x={zoneX(leftX) + zoneW / 2} y={zoneY + 16} dir="up" color={arrowC} />
      </g>
      <g className="ob-arrow-down" style={{ transformOrigin: `${zoneX(leftX) + zoneW / 2}px ${zoneY + zoneH - 14}px` }}>
        <ArrowV x={zoneX(leftX) + zoneW / 2} y={zoneY + zoneH - 14} dir="down" color={arrowC} />
      </g>
      <g className="ob-arrow-up" style={{ transformOrigin: `${zoneX(rightX) + zoneW / 2}px ${zoneY + 16}px` }}>
        <ArrowV x={zoneX(rightX) + zoneW / 2} y={zoneY + 16} dir="up" color={arrowC} />
      </g>
      <g className="ob-arrow-down" style={{ transformOrigin: `${zoneX(rightX) + zoneW / 2}px ${zoneY + zoneH - 14}px` }}>
        <ArrowV x={zoneX(rightX) + zoneW / 2} y={zoneY + zoneH - 14} dir="down" color={arrowC} />
      </g>

      {/* 스크롤 레이블 */}
      <text x={zoneX(leftX) + zoneW / 2} y={zoneY + zoneH / 2 + 4}
        fill={arrowC} fontSize="7" textAnchor="middle"
        fontFamily="'Pretendard Variable','Noto Sans KR',sans-serif"
        letterSpacing="0.1em" opacity="0.8"
      >스크롤 영역</text>
      <text x={zoneX(rightX) + zoneW / 2} y={zoneY + zoneH / 2 + 4}
        fill={arrowC} fontSize="7" textAnchor="middle"
        fontFamily="'Pretendard Variable','Noto Sans KR',sans-serif"
        letterSpacing="0.1em" opacity="0.8"
      >스크롤 영역</text>

      {/* 이전 화살표 */}
      <g className="ob-arrow-left" style={{ transformOrigin: `${leftX - 18}px ${H / 2}px` }}>
        <ArrowH x={leftX - 18} y={H / 2} dir="left" color={navC} />
        <text x={leftX - 14} y={H / 2 + 14}
          fill={navC} fontSize="8" textAnchor="middle"
          fontFamily="'Pretendard Variable','Noto Sans KR',sans-serif"
          letterSpacing="0.05em" opacity="0.8"
        >이전</text>
      </g>

      {/* 다음 화살표 */}
      <g className="ob-arrow-right" style={{ transformOrigin: `${rightX + pageW + 18}px ${H / 2}px` }}>
        <ArrowH x={rightX + pageW + 18} y={H / 2} dir="right" color={navC} />
        <text x={rightX + pageW + 14} y={H / 2 + 14}
          fill={navC} fontSize="8" textAnchor="middle"
          fontFamily="'Pretendard Variable','Noto Sans KR',sans-serif"
          letterSpacing="0.05em" opacity="0.8"
        >다음</text>
      </g>
    </svg>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function OnboardingPopup({ variant = 'portrait', onDismiss }: OnboardingPopupProps) {
  const lsKey = variant === 'landscape' ? 'sihwa_guide_seen_pc' : 'sihwa_guide_seen'

  // Major-3: lazy initializer로 첫 페인트부터 정확한 상태 → 깜박임 제거.
  // SSR에서는 항상 false(window undefined)라 hydration mismatch 없음.
  const [visible, setVisible] = useState<boolean>(() => !readSeen(lsKey))
  const [exiting, setExiting] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // variant 전환(회전·창 크기 변경) 대응 — 키가 바뀌면 새 키 기준으로 재평가.
  useEffect(() => {
    setVisible(!readSeen(lsKey))
    setExiting(false)
  }, [lsKey])

  // Major-1: setTimeout cleanup 누락 race condition 해소.
  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
  }, [])

  const dismiss = () => {
    if (exiting) return // 더블 클릭/엔터 가드
    // Major-1+2: localStorage는 즉시 기록 — 380ms 사이 unmount되어도 재표시 안 됨.
    try { window.localStorage.setItem(lsKey, '1') } catch { /* noop: private/quota */ }
    setExiting(true)
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null
      setVisible(false)
      onDismiss?.()
    }, 380)
  }

  // Major-4: ESC 키로 닫기 + 첫 포커스를 "읽기 시작" 버튼에 둠.
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => buttonRef.current?.focus(), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
    // dismiss는 매 렌더 새 함수지만 effect 본문이 closure로만 참조 — re-bind OK
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ob-title"
      aria-describedby="ob-desc"
      style={{
        position: 'absolute', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(30,24,14,0.52)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: exiting ? 'ob-fade-out 0.38s ease forwards' : 'ob-fade-in 0.42s ease',
      }}
      onClick={dismiss}
    >
      <style>{`
        @keyframes ob-fade-in  { from { opacity:0; } to { opacity:1; } }
        @keyframes ob-fade-out { from { opacity:1; } to { opacity:0; } }
        @keyframes ob-card-in  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ob-arrow-bob-v {
          0%,100% { transform: translateY(0); opacity:0.55; }
          50%      { transform: translateY(5px); opacity:1; }
        }
        @keyframes ob-arrow-bob-vu {
          0%,100% { transform: translateY(0); opacity:0.55; }
          50%      { transform: translateY(-5px); opacity:1; }
        }
        @keyframes ob-arrow-bob-h {
          0%,100% { transform: translateX(0); opacity:0.55; }
          50%      { transform: translateX(4px); opacity:1; }
        }
        @keyframes ob-arrow-bob-hl {
          0%,100% { transform: translateX(0); opacity:0.55; }
          50%      { transform: translateX(-4px); opacity:1; }
        }
        .ob-arrow-down  { animation: ob-arrow-bob-v  1.4s ease-in-out infinite; }
        .ob-arrow-up    { animation: ob-arrow-bob-vu 1.4s ease-in-out infinite 0.2s; }
        .ob-arrow-right { animation: ob-arrow-bob-h  1.3s ease-in-out infinite 0.1s; }
        .ob-arrow-left  { animation: ob-arrow-bob-hl 1.3s ease-in-out infinite 0.3s; }
        .ob-start-btn { transition: background 0.15s, transform 0.1s; }
        .ob-start-btn:hover { background: #2a2014 !important; }
        .ob-start-btn:focus-visible { outline: 2px solid #c8a06a; outline-offset: 2px; }
        .ob-start-btn:active { transform: scale(0.98); }
        @media (prefers-reduced-motion: reduce) {
          .ob-arrow-up, .ob-arrow-down, .ob-arrow-left, .ob-arrow-right { animation: none !important; }
        }
      `}</style>

      {/* 카드 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fdf8f2',
          borderRadius: 16,
          padding: '32px 28px 24px',
          width: 310,
          maxWidth: '92vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
          animation: 'ob-card-in 0.48s cubic-bezier(0.22,1,0.36,1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        }}
      >
        {/* 헤더 */}
        <div id="ob-title" style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 15, fontWeight: 500,
          letterSpacing: '0.08em',
          color: '#2a2318',
          marginBottom: 4,
        }}>
          읽기 안내
        </div>
        <div id="ob-desc" style={{
          fontFamily: "'Pretendard Variable','Noto Sans KR',sans-serif",
          fontSize: 11, fontWeight: 300,
          letterSpacing: '0.16em',
          color: '#8a7a60',
          marginBottom: 24,
        }}>
          이렇게 넘겨보세요
        </div>

        {/* SVG 일러스트 */}
        {variant === 'landscape' ? <BookIllustrationLandscape /> : <BookIllustrationPortrait />}

        {/* 범례 */}
        {variant === 'landscape' ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            gap: 10,
            marginTop: 20, marginBottom: 24,
            width: '100%',
          }}>
            <Legend icon="↕" text="각 페이지 중앙 영역(흰 박스)에서만 스크롤 가능합니다" />
            <Legend icon="→" text="오른쪽 가장자리 탭 또는 다음 → 버튼으로 다음 시 이동" />
            <Legend icon="←" text="왼쪽 가장자리 탭 또는 ← 이전 버튼으로 이전 시 이동" />
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '10px 16px',
            marginTop: 20, marginBottom: 24,
            width: '100%',
          }}>
            <Legend icon="↕" text="시 안에서 위아래 스크롤" />
            <Legend icon="→" text="다음 시로 이동" />
            <Legend icon="←" text="이전 시로 이동" />
            <Legend icon="↔" text="좌우 스와이프도 가능" />
          </div>
        )}

        {/* 버튼 */}
        <button
          ref={buttonRef}
          className="ob-start-btn"
          onClick={dismiss}
          style={{
            fontFamily: "'Pretendard Variable','Noto Sans KR',sans-serif",
            fontWeight: 400, fontSize: 12,
            letterSpacing: '0.18em',
            color: '#fdf8f2',
            background: '#3a2e1e',
            border: 'none',
            borderRadius: 24,
            padding: '11px 36px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          읽기 시작
        </button>

        <div style={{
          fontFamily: "'Pretendard Variable','Noto Sans KR',sans-serif",
          fontSize: 10, color: '#b09a7a',
          marginTop: 12, letterSpacing: '0.1em',
        }}>
          화면을 탭해도 닫힙니다
        </div>
      </div>
    </div>
  )
}

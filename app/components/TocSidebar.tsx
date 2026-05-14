'use client'
import { useEffect, useRef, useState } from 'react'
import type { Quarter, Round, Poem, FreePoem } from '@/lib/firebase'

export type TocSidebarProps = {
  quarters: Quarter[]
  rounds: Round[]
  poems: Poem[]
  freePoems: FreePoem[]
  open: boolean
  onClose: () => void
  viewportMode: 'pc' | 'mobile'
  currentPoemId?: string | null
  onSelectPoem: (id: string, isFree: boolean) => void
  onSelectRound: (roundId: string) => void
  onSelectQuarter?: (quarterId: string) => void
}

export function TocSidebar(props: TocSidebarProps) {
  const {
    quarters,
    rounds,
    poems,
    freePoems,
    open,
    onClose,
    viewportMode,
    currentPoemId,
    onSelectPoem,
    onSelectRound,
    onSelectQuarter,
  } = props

  const sortedQuarters = [...quarters].sort((a, b) => a.order - b.order)

  const roundsByQuarter = (qid: string): Round[] =>
    rounds.filter(r => r.quarterId === qid).sort((a, b) => a.order - b.order)

  const poemsByRound = (rid: string): Poem[] =>
    poems.filter(p => p.roundId === rid).sort((a, b) => a.order - b.order)

  const freePoemsByQuarter = (qid: string): FreePoem[] =>
    freePoems.filter(f => f.quarterId === qid).sort((a, b) => a.order - b.order)

  const [openQuarters, setOpenQuarters] = useState<Set<string>>(
    () => new Set(quarters.map(q => q.id))
  )
  const [openRounds, setOpenRounds] = useState<Set<string>>(
    () => new Set(rounds.map(r => r.id))
  )

  const toggleQuarter = (qid: string) => {
    setOpenQuarters(prev => {
      const next = new Set(prev)
      if (next.has(qid)) next.delete(qid)
      else next.add(qid)
      return next
    })
  }

  const toggleRound = (rid: string) => {
    setOpenRounds(prev => {
      const next = new Set(prev)
      if (next.has(rid)) next.delete(rid)
      else next.add(rid)
      return next
    })
  }

  // Focus trap refs for mobile
  const rootRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Focus first element on open (mobile), restore on close
  useEffect(() => {
    if (viewportMode !== 'mobile') return
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      closeButtonRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [open, viewportMode])

  // Escape key closes on mobile
  useEffect(() => {
    if (viewportMode !== 'mobile') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, viewportMode])

  const handleSelectPoem = (id: string, isFree: boolean) => {
    onSelectPoem(id, isFree)
    if (viewportMode === 'mobile') onClose()
  }

  const handleSelectRound = (rid: string) => {
    toggleRound(rid)
    onSelectRound(rid)
  }

  const handleSelectQuarter = (qid: string) => {
    toggleQuarter(qid)
    onSelectQuarter?.(qid)
  }

  const inner = (
    <>
      <div className="toc-sb-header">
        <span>목차</span>
        {viewportMode === 'mobile' && (
          <button
            ref={closeButtonRef}
            className="toc-sb-close"
            onClick={onClose}
            aria-label="목차 닫기"
          >
            ×
          </button>
        )}
      </div>
      <div className="toc-sb-list">
        {sortedQuarters.map(q => {
          const qRounds = roundsByQuarter(q.id)
          const qFree = freePoemsByQuarter(q.id)
          const qExpanded = openQuarters.has(q.id)
          return (
            <div
              key={q.id}
              className="toc-sb-quarter"
              data-expanded={qExpanded}
            >
              <div
                className="toc-sb-quarter-head"
                role="button"
                tabIndex={0}
                aria-expanded={qExpanded}
                onClick={() => handleSelectQuarter(q.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectQuarter(q.id)
                  }
                }}
              >
                <span className="toc-sb-caret">▶</span>
                <span>{q.title}</span>
              </div>
              {qExpanded && (
                <>
                  {qRounds.map(r => {
                    const rPoems = poemsByRound(r.id)
                    if (!rPoems.length) return null
                    const rExpanded = openRounds.has(r.id)
                    return (
                      <div
                        key={r.id}
                        className="toc-sb-round"
                        data-expanded={rExpanded}
                      >
                        <div
                          className="toc-sb-round-head"
                          role="button"
                          tabIndex={0}
                          aria-expanded={rExpanded}
                          onClick={() => handleSelectRound(r.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleSelectRound(r.id)
                            }
                          }}
                        >
                          <span className="toc-sb-caret">▶</span>
                          <span>
                            {r.num}회차 — {r.title}
                          </span>
                        </div>
                        {rExpanded && (
                          <div className="toc-sb-poems">
                            {rPoems.map(p => (
                              <button
                                key={p.id}
                                className={`toc-sb-poem${currentPoemId === p.id ? ' is-current' : ''}`}
                                aria-current={currentPoemId === p.id ? 'page' : undefined}
                                onClick={() => handleSelectPoem(p.id, false)}
                              >
                                {p.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {qFree.length > 0 && (
                    <div className="toc-sb-round toc-sb-free-section" data-expanded="true">
                      <div className="toc-sb-round-head toc-sb-free-head">
                        <span className="toc-sb-caret" style={{ visibility: 'hidden' }}>▶</span>
                        <span>자유시</span>
                      </div>
                      <div className="toc-sb-poems">
                        {qFree.map(f => (
                          <button
                            key={f.id}
                            className={`toc-sb-poem${currentPoemId === f.id ? ' is-current' : ''}`}
                            aria-current={currentPoemId === f.id ? 'page' : undefined}
                            onClick={() => handleSelectPoem(f.id, true)}
                          >
                            {f.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </>
  )

  if (viewportMode === 'pc') {
    return (
      <aside
        className="toc-sidebar-pc"
        data-open={open}
        role="navigation"
        aria-label="목차"
      >
        {inner}
      </aside>
    )
  }

  return (
    <div
      ref={rootRef}
      className="toc-sidebar-mobile"
      data-open={open}
      role="navigation"
      aria-label="목차"
    >
      {inner}
    </div>
  )
}

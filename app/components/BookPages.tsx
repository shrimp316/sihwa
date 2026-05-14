'use client'

import type { Quarter, Round, Poem, FreePoem } from '@/lib/firebase'
import type { PageItem } from '@/lib/bookData'
import { safeImageUrl } from '@/lib/validation'
import { useCoverContext } from './CoverContext'

export interface BookSourceData {
  quarters: Quarter[]
  rounds: Round[]
  poems: Poem[]
  freePoems: FreePoem[]
  onSelectPoem?: (poemId: string, isFree: boolean) => void
}

interface PageContentProps {
  page: PageItem | null | undefined
  side: 'left' | 'right' | 'single'
  totalPages: number
  data: BookSourceData
}

export function PageContent({ page, totalPages, data }: PageContentProps) {
  if (!page) return null
  switch (page.type) {
    case 'front-cover':
      return <FrontCover />
    case 'back-cover':
      return <BackCover />
    case 'title-page':
      return <TitlePage />
    case 'copyright':
      return <Copyright />
    case 'toc-title':
      return <TocTitle />
    case 'toc-quarter':
      return <TocQuarter quarter={page.quarter!} qi={page.qi!} data={data} />
    case 'quarter-divider':
      return <QuarterDivider quarter={page.quarter!} qi={page.qi!} />
    case 'quarter-intro':
      return <QuarterIntro quarter={page.quarter!} />
    case 'round-divider':
      return <RoundDivider round={page.round!} />
    case 'poem':
    case 'free-poem':
      return <PoemPage page={page} />
    case 'free-divider':
      return <FreeDivider quarter={page.quarter!} />
    case 'end':
      return <EndPage />
    case 'colophon':
      return <Colophon totalPages={totalPages} />
    case 'blank':
      return <BlankPage kind={page.kind} />
    default:
      return null
  }
}

// ── Covers ──────────────────────────────────────────────────────────────
function FrontCover() {
  const ctx = useCoverContext()
  const url = safeImageUrl(ctx.front)
  return (
    <div className="pg pg-cover">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          alt="앞표지"
        />
      ) : (
        <div className="pg-cover-label">시화 앞표지</div>
      )}
    </div>
  )
}

function BackCover() {
  const ctx = useCoverContext()
  const url = safeImageUrl(ctx.back)
  return (
    <div className="pg pg-cover">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          alt="뒷표지"
        />
      ) : (
        <div className="pg-cover-label">시화 뒷표지</div>
      )}
    </div>
  )
}

// ── Title block ─────────────────────────────────────────────────────────
function TitlePage() {
  return (
    <div className="pg pg-center">
      <div className="tp-ornament">✦</div>
      <div className="tp-title">
        시화<span className="tp-han">詩和</span>
      </div>
      <div className="tp-sub">글빛을 모아 담다</div>
      <div className="tp-rule" />
      <div className="tp-year">2026</div>
    </div>
  )
}

function Copyright() {
  return (
    <div className="pg pg-copyright">
      <div className="cp-block">
        <div className="cp-title">시화 詩和</div>
        <div className="cp-line">초판 1쇄 — 2026년 봄</div>
        <div className="cp-line">엮은이 · 시화 동인</div>
        <div className="cp-line">디자인 · 시화 편집부</div>
      </div>
      <div className="cp-rule" />
      <div className="cp-fine">
        본 책에 실린 모든 작품의 저작권은
        <br />
        각 작가에게 있습니다.
      </div>
    </div>
  )
}

// ── TOC ─────────────────────────────────────────────────────────────────
function TocTitle() {
  return (
    <div className="pg pg-center">
      <div className="toc-tt-eyebrow">차 례</div>
      <div className="toc-tt-rule" />
      <div className="toc-tt-sub">CONTENTS</div>
    </div>
  )
}

function TocQuarter({
  quarter,
  qi,
  data,
}: {
  quarter: Quarter
  qi: number
  data: BookSourceData
}) {
  const rounds = data.rounds
    .filter(r => r.quarterId === quarter.id)
    .sort((a, b) => a.order - b.order)
  const free = data.freePoems
    .filter(f => f.quarterId === quarter.id)
    .sort((a, b) => a.order - b.order)

  return (
    <div className="pg pg-toc">
      <div className="toc-q-eyebrow">{qi + 1}분기</div>
      <div className="toc-q-title">{quarter.title}</div>
      <div className="toc-q-rule" />
      <div className="toc-q-list">
        {rounds.map(r => {
          const rPoems = data.poems
            .filter(p => p.roundId === r.id)
            .sort((a, b) => a.order - b.order)
          if (!rPoems.length) return null
          return (
            <div key={r.id} className="toc-q-round">
              <div className="toc-q-round-label">
                {r.num}회차 — {r.title}
              </div>
              {rPoems.map(p => (
                <div
                  key={p.id}
                  className="toc-q-item"
                  onClick={() => data.onSelectPoem?.(p.id, false)}
                >
                  <span className="toc-q-item-t">{p.title}</span>
                  <span className="toc-q-item-dots" />
                  <span className="toc-q-item-p">{p.poet}</span>
                </div>
              ))}
            </div>
          )
        })}
        {free.length > 0 && (
          <div className="toc-q-round">
            <div className="toc-q-round-label">자유시</div>
            {free.map(f => (
              <div
                key={f.id}
                className="toc-q-item"
                onClick={() => data.onSelectPoem?.(f.id, true)}
              >
                <span className="toc-q-item-t">{f.title}</span>
                <span className="toc-q-item-dots" />
                <span className="toc-q-item-p">{f.poet}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Quarter / Round dividers ────────────────────────────────────────────
function QuarterDivider({ quarter, qi }: { quarter: Quarter; qi: number }) {
  return (
    <div className="pg pg-qdiv" style={{ overflow: 'hidden' }}>
      <div className="qd-eyebrow">{qi + 1}분기</div>
      <div className="qd-title">{quarter.title}</div>
      <div style={{ width: 20, height: 1, background: '#111', marginTop: 18 }} />
    </div>
  )
}

function QuarterIntro({ quarter }: { quarter: Quarter }) {
  return (
    <div className="pg pg-center pg-qintro">
      <div className="qi-body">{quarter.intro}</div>
    </div>
  )
}

function RoundDivider({ round }: { round: Round }) {
  return (
    <div className="pg pg-rdiv" style={{ overflow: 'hidden' }}>
      <div className="rd-eyebrow">{round.num}회차</div>
      <div className="rd-title">{round.title}</div>
      <div className="rd-rule" />
    </div>
  )
}

function FreeDivider({ quarter }: { quarter: Quarter }) {
  return (
    <div className="pg pg-rdiv" style={{ overflow: 'hidden' }}>
      <div className="rd-eyebrow">자유시</div>
      <div className="rd-title">{quarter.title}</div>
      <div className="rd-rule" />
    </div>
  )
}

// ── Poem entry ──────────────────────────────────────────────────────────
function PoemPage({ page }: { page: PageItem }) {
  const poem = (page.poem || page.freePoem) as Poem | FreePoem | undefined
  if (!poem) return null
  const body = page.bodyChunk ?? poem.body
  const isFirst = (page.chunkIdx ?? 0) === 0
  const hasMore = (page.totalChunks ?? 1) > 1 && (page.chunkIdx ?? 0) < (page.totalChunks ?? 1) - 1

  return (
    <div className="pg pg-poem">
      {isFirst ? (
        <>
          <div className="po-poet">{poem.poet}</div>
          <div className="po-title">{poem.title}</div>
          <div className="po-rule" />
        </>
      ) : (
        <div className="po-cont-header">
          <span className="po-cont-title">{poem.title}</span>
          <span className="po-cont-sep">·</span>
          <span className="po-cont-poet">{poem.poet}</span>
        </div>
      )}
      <div className="po-body">{body}</div>
      {hasMore && <div className="po-continues">다음 페이지로 이어집니다 →</div>}
    </div>
  )
}

// ── End block ───────────────────────────────────────────────────────────
function EndPage() {
  return (
    <div className="pg pg-center pg-end">
      <div className="end-ornament">✦</div>
      <div className="end-title">시 화</div>
      <div className="end-sub">— 끝 —</div>
    </div>
  )
}

function Colophon({ totalPages }: { totalPages: number }) {
  return (
    <div className="pg pg-copyright">
      <div className="cp-rule" />
      <div className="cp-block">
        <div className="cp-line">시화 詩和 — 공동시집</div>
        <div className="cp-line">발행 · 시화 동인</div>
        <div className="cp-line">전체 {totalPages}쪽</div>
      </div>
      <div className="cp-rule" />
      <div className="cp-fine">
        © 2026 시화 동인.
        <br />
        무단 전재 및 복제 금지.
      </div>
    </div>
  )
}

function BlankPage({ kind }: { kind?: string }) {
  return <div className="pg pg-blank" data-kind={kind} />
}

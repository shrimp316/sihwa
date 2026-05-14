import type { Quarter, Round, Poem, FreePoem } from './firebase'

export type PageType =
  | 'front-cover'
  | 'back-cover'
  | 'blank'
  | 'title-page'
  | 'copyright'
  | 'toc-title'
  | 'toc-quarter'
  | 'quarter-divider'
  | 'quarter-intro'
  | 'round-divider'
  | 'poem'
  | 'free-poem'
  | 'free-divider'
  | 'end'
  | 'colophon'

export interface PageItem {
  type: PageType
  poem?: Poem
  freePoem?: FreePoem
  round?: Round
  quarter?: Quarter
  qi?: number
  pageNum?: number
  kind?: string
}

export interface BookData {
  quarters: Quarter[]
  rounds: Round[]
  poems: Poem[]
  freePoems: FreePoem[]
}

export function buildBookPages(data: BookData, _opts: Record<string, unknown> = {}): PageItem[] {
  void _opts // legacy opts arg retained for BC; pagination is no longer needed (1 poem = 1 page)
  const { quarters, rounds, poems, freePoems } = data
  const qSorted = [...quarters].sort((a, b) => a.order - b.order)
  const pages: PageItem[] = []

  // Front matter
  pages.push({ type: 'front-cover' })
  pages.push({ type: 'blank', kind: 'verso-of-cover' })
  pages.push({ type: 'title-page' })
  pages.push({ type: 'copyright' })
  pages.push({ type: 'toc-title' })

  qSorted.forEach((q, qi) => {
    pages.push({ type: 'toc-quarter', quarter: q, qi })
  })

  // Body — 1 poem per page (no chunking)
  qSorted.forEach((q, qi) => {
    const qRounds = rounds.filter(r => r.quarterId === q.id).sort((a, b) => a.order - b.order)
    const hasRoundPoems = qRounds.some(r => poems.some(p => p.roundId === r.id))
    const qFree = freePoems.filter(f => f.quarterId === q.id).sort((a, b) => a.order - b.order)
    if (!hasRoundPoems && !qFree.length) return

    pages.push({ type: 'quarter-divider', quarter: q, qi })
    if (q.intro) pages.push({ type: 'quarter-intro', quarter: q })

    qRounds.forEach(r => {
      const rPoems = poems.filter(p => p.roundId === r.id).sort((a, b) => a.order - b.order)
      if (!rPoems.length) return
      pages.push({ type: 'round-divider', round: r, quarter: q })
      rPoems.forEach(p => {
        pages.push({ type: 'poem', poem: p, round: r, quarter: q })
      })
    })

    if (qFree.length) {
      pages.push({ type: 'free-divider', quarter: q })
      qFree.forEach(f => {
        pages.push({ type: 'free-poem', freePoem: f, quarter: q })
      })
    }
  })

  // Back matter
  pages.push({ type: 'end' })
  pages.push({ type: 'colophon' })
  pages.push({ type: 'blank', kind: 'flyleaf-back' })
  pages.push({ type: 'back-cover' })

  // PE-3: divider-gated blank padding (mutation-safe backward iteration).
  // If a poem lands on an odd index (spread-right) immediately after a divider/intro,
  // insert a blank so the poem moves to even index (spread-left). This preserves the
  // visual rhythm where dividers introduce a poem on the next spread's left page.
  for (let k = pages.length - 1; k >= 1; k--) {
    const p = pages[k]
    const prev = pages[k - 1]
    const isPoem = p.type === 'poem' || p.type === 'free-poem'
    const prevIsBoundary =
      prev.type === 'round-divider' ||
      prev.type === 'quarter-divider' ||
      prev.type === 'quarter-intro' ||
      prev.type === 'free-divider'
    if (isPoem && prevIsBoundary && k % 2 === 1) {
      pages.splice(k, 0, { type: 'blank', kind: 'spread-pad-pre-poem' })
    }
  }

  // Spread alignment: prepend pre-cover blank, pad to even length
  pages.unshift({ type: 'blank', kind: 'pre-cover' })
  if (pages.length % 2 !== 0) pages.push({ type: 'blank', kind: 'pad' })

  // Arabic page numbers (skip covers, blanks, front-matter)
  let n = 0
  const unnumbered = new Set<PageType>([
    'front-cover',
    'back-cover',
    'blank',
    'title-page',
    'copyright',
    'colophon',
    'toc-title',
    'toc-quarter',
  ])
  pages.forEach(p => {
    if (!unnumbered.has(p.type)) p.pageNum = ++n
  })

  return pages
}

export function quarterContextFor(page: PageItem | undefined | null): string {
  if (!page) return ''
  if (page.quarter) return page.quarter.title
  return ''
}

export function labelForPage(page: PageItem | undefined | null): string {
  if (!page) return ''
  switch (page.type) {
    case 'front-cover':
      return '표지'
    case 'title-page':
      return '속표지'
    case 'copyright':
      return '판권지'
    case 'toc-title':
      return '차례'
    case 'toc-quarter':
      return `차례 — ${page.quarter?.title ?? ''}`
    case 'quarter-divider':
      return `${(page.qi ?? 0) + 1}분기 표지`
    case 'quarter-intro':
      return `${page.quarter?.title ?? ''} — 소개`
    case 'round-divider':
      return `${page.round?.num ?? ''}회차 — ${page.round?.title ?? ''}`
    case 'free-divider':
      return `자유시 — ${page.quarter?.title ?? ''}`
    case 'end':
      return '끝'
    case 'colophon':
      return '판권'
    case 'back-cover':
      return '뒷표지'
    default:
      return ''
  }
}

export function findPageIdx(pages: PageItem[], predicate: (p: PageItem) => boolean): number {
  return pages.findIndex(predicate)
}

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
  bodyChunk?: string
  chunkIdx?: number
  totalChunks?: number
  kind?: string
}

export interface PaginateOpts {
  maxFirst?: number
  maxCont?: number
  chars?: number
}

export function paginateBody(body: string, opts: PaginateOpts = {}): string[] {
  const { maxFirst = 14, maxCont = 20, chars = 22 } = opts

  const countLines = (text: string) => {
    if (!text) return 1
    return Math.max(1, Math.ceil(text.length / chars))
  }

  const rawStanzas = body.split(/\n{2,}/).map(s => s.split('\n'))
  const entries = rawStanzas.map((stanza, si) => ({ lines: stanza, blankBefore: si > 0 }))

  const chunks: string[] = []
  let buf: string[] = []
  let used = 0

  const flush = () => {
    if (buf.length === 0) return
    while (buf.length > 0 && buf[0] === '') buf.shift()
    while (buf.length > 0 && buf[buf.length - 1] === '') buf.pop()
    if (buf.length > 0) chunks.push(buf.join('\n'))
    buf = []
    used = 0
  }

  const maxForChunk = () => (chunks.length === 0 ? maxFirst : maxCont)

  entries.forEach(({ lines, blankBefore }) => {
    const blankCost = blankBefore ? 1 : 0
    const stanzaLines = lines.reduce((acc, l) => acc + countLines(l), 0)
    const totalCost = blankCost + stanzaLines

    if (used + totalCost > maxForChunk() && buf.length > 0) {
      flush()
    }

    if (stanzaLines > maxForChunk()) {
      if (blankBefore && buf.length > 0) {
        buf.push('')
        used += 1
      }
      lines.forEach(line => {
        const lc = countLines(line)
        if (used + lc > maxForChunk() && buf.length > 0) {
          flush()
        }
        buf.push(line)
        used += lc
      })
    } else {
      if (blankBefore && buf.length > 0) {
        buf.push('')
        used += 1
      }
      lines.forEach(l => {
        buf.push(l)
        used += countLines(l)
      })
    }
  })
  flush()

  return chunks.length > 0 ? chunks : [body]
}

export interface BookData {
  quarters: Quarter[]
  rounds: Round[]
  poems: Poem[]
  freePoems: FreePoem[]
}

export function buildBookPages(data: BookData, opts: PaginateOpts = {}): PageItem[] {
  const { quarters, rounds, poems, freePoems } = data
  const paginationOpts: PaginateOpts = { maxFirst: 14, maxCont: 20, chars: 22, ...opts }
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

  // Body
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
        const chunks = paginateBody(p.body, paginationOpts)
        chunks.forEach((chunk, ci) => {
          pages.push({
            type: 'poem',
            poem: p,
            round: r,
            quarter: q,
            bodyChunk: chunk,
            chunkIdx: ci,
            totalChunks: chunks.length,
          })
        })
      })
    })

    if (qFree.length) {
      pages.push({ type: 'free-divider', quarter: q })
      qFree.forEach(f => {
        const chunks = paginateBody(f.body, paginationOpts)
        chunks.forEach((chunk, ci) => {
          pages.push({
            type: 'free-poem',
            freePoem: f,
            quarter: q,
            bodyChunk: chunk,
            chunkIdx: ci,
            totalChunks: chunks.length,
          })
        })
      })
    }
  })

  // Back matter
  pages.push({ type: 'end' })
  pages.push({ type: 'colophon' })
  pages.push({ type: 'blank', kind: 'flyleaf-back' })
  pages.push({ type: 'back-cover' })

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

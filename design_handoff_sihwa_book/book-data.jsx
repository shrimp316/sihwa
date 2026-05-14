// book-data.jsx — sample data + page-list builder with stanza-aware pagination.
// Two exported page lists: one tuned for single-page (portrait), one for spread.

const SIHWA_DATA = {
  quarters: [
    { id: 'q1', title: '계절', intro: '계절은 늘 우리보다 먼저\n도착해 있었다', order: 0 },
    { id: 'q2', title: '관계', intro: '', order: 1 },
  ],
  rounds: [
    { id: 'r1', title: '봄',  num: 1, quarterId: 'q1', order: 0 },
    { id: 'r2', title: '여름', num: 2, quarterId: 'q1', order: 1 },
    { id: 'r3', title: '처음', num: 3, quarterId: 'q2', order: 0 },
    { id: 'r4', title: '이별', num: 4, quarterId: 'q2', order: 1 },
  ],
  poems: [
    {
      id: 'p1', roundId: 'r1', poet: '김하늘', title: '봄의 기억', order: 0,
      body: '봄이 오면 나는 늘\n창문 하나를 더 열어두었다\n\n바람이 커튼을 밀어내고\n그 틈으로 햇빛이 들어와\n방 안 가득 쌓인 먼지들을\n하나씩 들어 올리던 날\n\n너는 그 먼지들 사이에 있었다',
    },
    {
      id: 'p2', roundId: 'r1', poet: '이서준', title: '연두색 오후', order: 1,
      body: '연두색이 번지던 오후\n나는 창가에 앉아\n아무것도 하지 않았다\n\n그게 가장 봄다운 일이었다',
    },
    {
      id: 'p3', roundId: 'r2', poet: '박지유', title: '여름 끝에서', order: 0,
      body: '여름은 늘 너무 갑자기 끝난다\n분명 뜨거웠는데\n어느 날 보면 이미 식어있어\n\n우리가 그랬던 것처럼\n\n처음엔 서운했다\n식어가는 것이 내 탓인 줄 알았다\n\n하지만 여름이 끝나는 건\n여름의 탓이 아니다\n그냥 그런 계절이 있을 뿐',
    },
    {
      id: 'p4', roundId: 'r3', poet: '최민아', title: '처음 본 얼굴', order: 0,
      body: '처음 본 얼굴인데\n어딘가 낯이 익었다\n\n아마도 내가 오래\n기다려온 얼굴이라서',
    },
    {
      id: 'p5', roundId: 'r4', poet: '정우찬', title: '이별의 문법', order: 0,
      body: '이별에도 문법이 있다면\n주어는 언제나 둘이고\n동사는 언제나 하나다\n\n우리는 같은 문장을\n다른 시제로 읽었다\n\n네가 과거형으로 읽을 때\n나는 아직 현재진행형이었다',
    },
  ],
  freePoems: [
    {
      id: 'f1', quarterId: 'q1', poet: '오하린', title: '여백', order: 0,
      body: '아무것도 쓰지 않은 페이지가\n가장 많은 말을 한다\n\n빈 곳을 채우려는 손을 멈추고\n그냥 두는 법을 배웠다',
    },
  ],
  galleryItems: [
    {
      id: 'g1', quarterId: 'q1', title: '봄 삽화 — 연두빛 창가', type: 'illust',
      note: '봄의 기억 수록 삽화. 빛이 들어오는 창과 커튼을 모티프로.',
      imageUrl: '', order: 0,
    },
    {
      id: 'g2', quarterId: 'q1', title: '여름 배경', type: 'bg',
      note: '여름 끝에서 수록 배경 삽화.',
      imageUrl: '', order: 1,
    },
    {
      id: 'g3', quarterId: 'q2', title: '처음 본 얼굴 — 스케치', type: 'illust',
      note: '처음 본 얼굴 수록 삽화. 흑연 연필 느낌.',
      imageUrl: '', order: 0,
    },
    {
      id: 'g4', quarterId: 'q2', title: '이별의 문장', type: 'etc',
      note: '이별의 문법 발췌 타이포그래피 작업.',
      imageUrl: '', order: 1,
    },
  ],
};

// ─── PAGINATION HELPER ────────────────────────────────────────────────
// Splits a poem body into page-sized chunks, always breaking at stanza
// boundaries (double newlines). If a stanza alone exceeds maxLines it is
// split at individual line boundaries as a last resort.
//
// opts.maxFirst — max visual lines on the first chunk (includes header room)
// opts.maxCont  — max visual lines on continuation chunks
// opts.chars    — estimated chars per visual line (for wrap estimation)

function paginateBody(body, opts) {
  const { maxFirst = 14, maxCont = 20, chars = 22 } = opts || {};

  // Estimate visual lines a text line occupies (word-wrap approximation).
  const countLines = (text) => {
    if (!text) return 1;             // blank lines between stanzas
    return Math.max(1, Math.ceil(text.length / chars));
  };

  // Parse body into stanzas (arrays of lines).
  const rawStanzas = body.split(/\n{2,}/).map(s => s.split('\n'));

  // Build a flat sequence of "entries": each is { lines[], blankBefore }.
  const entries = rawStanzas.map((stanza, si) => ({ lines: stanza, blankBefore: si > 0 }));

  const chunks = [];

  // greedy pack
  let buf = [];        // accumulated lines for current chunk (raw, with blanks)
  let used = 0;        // visual line count used so far

  const flush = () => {
    if (buf.length === 0) return;
    // Trim leading/trailing blank lines from chunk
    while (buf.length > 0 && buf[0] === '') buf.shift();
    while (buf.length > 0 && buf[buf.length - 1] === '') buf.pop();
    if (buf.length > 0) chunks.push(buf.join('\n'));
    buf = []; used = 0;
  };

  const maxForChunk = () => (chunks.length === 0 ? maxFirst : maxCont);

  entries.forEach(({ lines, blankBefore }) => {
    // Visual cost of the blank separator before this stanza
    const blankCost = blankBefore ? 1 : 0;
    // Visual cost of all lines in the stanza (with wrap)
    const stanzaLines = lines.reduce((acc, l) => acc + countLines(l), 0);
    const totalCost = blankCost + stanzaLines;

    // Does this stanza fit in the current chunk?
    if (used + totalCost > maxForChunk() && buf.length > 0) {
      flush();
    }

    // Does this stanza fit in a fresh chunk on its own?
    if (stanzaLines > maxForChunk()) {
      // Stanza is too long even alone — split line by line.
      if (blankBefore && buf.length > 0) {
        buf.push('');
        used += 1;
      }
      lines.forEach((line) => {
        const lc = countLines(line);
        if (used + lc > maxForChunk() && buf.length > 0) {
          flush();
        }
        buf.push(line);
        used += lc;
      });
    } else {
      // Normal stanza — add blank separator then stanza lines.
      if (blankBefore && buf.length > 0) {
        buf.push('');
        used += 1;
      }
      lines.forEach(l => { buf.push(l); used += countLines(l); });
    }
  });
  flush();

  return chunks.length > 0 ? chunks : [body];
}

// ─── PAGE LIST BUILDER ────────────────────────────────────────────────
// opts.maxFirst, opts.maxCont, opts.chars — passed through to paginateBody.
// mode: 'single' | 'spread' — sets default pagination limits if opts not given.

function buildBookPages(data, opts) {
  const { quarters, rounds, poems, freePoems } = data;

  // Sensible defaults per display mode. Callers may override any field.
  const paginationOpts = Object.assign(
    { maxFirst: 14, maxCont: 20, chars: 22 },
    opts,
  );

  const qSorted = [...quarters].sort((a, b) => a.order - b.order);
  const pages = [];

  // ── Front matter ──────────────────────────────────────────────────
  pages.push({ type: 'front-cover' });
  pages.push({ type: 'blank', kind: 'verso-of-cover' });
  pages.push({ type: 'title-page' });
  pages.push({ type: 'copyright' });
  pages.push({ type: 'toc-title' });

  qSorted.forEach((q, qi) => {
    pages.push({ type: 'toc-quarter', quarter: q, qi });
  });

  // ── Body ─────────────────────────────────────────────────────────
  qSorted.forEach((q, qi) => {
    const qRounds = rounds.filter(r => r.quarterId === q.id).sort((a, b) => a.order - b.order);
    const hasRoundPoems = qRounds.some(r => poems.some(p => p.roundId === r.id));
    const qFree = freePoems.filter(f => f.quarterId === q.id).sort((a, b) => a.order - b.order);
    if (!hasRoundPoems && !qFree.length) return;

    pages.push({ type: 'quarter-divider', quarter: q, qi });
    if (q.intro) pages.push({ type: 'quarter-intro', quarter: q });

    qRounds.forEach(r => {
      const rPoems = poems.filter(p => p.roundId === r.id).sort((a, b) => a.order - b.order);
      if (!rPoems.length) return;
      pages.push({ type: 'round-divider', round: r, quarter: q });
      rPoems.forEach(p => {
        const chunks = paginateBody(p.body, paginationOpts);
        chunks.forEach((chunk, ci) => {
          pages.push({
            type: 'poem', poem: p, round: r, quarter: q,
            bodyChunk: chunk, chunkIdx: ci, totalChunks: chunks.length,
          });
        });
      });
    });

    if (qFree.length) {
      pages.push({ type: 'free-divider', quarter: q });
      qFree.forEach(f => {
        const chunks = paginateBody(f.body, paginationOpts);
        chunks.forEach((chunk, ci) => {
          pages.push({
            type: 'free-poem', freePoem: f, quarter: q,
            bodyChunk: chunk, chunkIdx: ci, totalChunks: chunks.length,
          });
        });
      });
    }
  });

  // ── Back matter ───────────────────────────────────────────────────
  pages.push({ type: 'end' });
  pages.push({ type: 'colophon' });
  pages.push({ type: 'blank', kind: 'flyleaf-back' });
  pages.push({ type: 'back-cover' });

  // For spread mode: prepend a blank so front-cover lands on the RIGHT
  // of spread[0], then pad to even length.
  pages.unshift({ type: 'blank', kind: 'pre-cover' });
  if (pages.length % 2 !== 0) pages.push({ type: 'blank', kind: 'pad' });

  // Assign content page numbers (arabic, skipping covers/front-matter/blanks).
  let n = 0;
  const unnumbered = new Set([
    'front-cover', 'back-cover', 'blank', 'title-page',
    'copyright', 'colophon', 'pre-cover',
  ]);
  pages.forEach(p => {
    if (!unnumbered.has(p.type)) p.pageNum = ++n;
  });

  return pages;
}

function quarterContextFor(page) {
  if (!page) return '';
  if (page.quarter) return page.quarter.title;
  return '';
}

Object.assign(window, {
  SIHWA_DATA, buildBookPages, paginateBody, quarterContextFor,
});

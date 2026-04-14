'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { db, Quarter, Round, Poem, FreePoem } from '@/lib/firebase'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy
} from 'firebase/firestore'

const EDIT_PASSWORD = process.env.NEXT_PUBLIC_EDIT_PASSWORD || 'tlghk2026'
const SNAPSHOT_KEY = 'sihwa_snapshot'

const SAMPLE: { quarters: Quarter[]; rounds: Round[]; poems: Poem[]; freePoems: FreePoem[] } = {
  quarters: [
    { id: 'q1', title: '계절', order: 0 },
    { id: 'q2', title: '관계', order: 1 },
  ],
  rounds: [
    { id: 'r1', title: '봄', num: 1, quarter_id: 'q1', order: 0 },
    { id: 'r2', title: '여름', num: 2, quarter_id: 'q1', order: 1 },
    { id: 'r3', title: '처음', num: 3, quarter_id: 'q2', order: 0 },
    { id: 'r4', title: '이별', num: 4, quarter_id: 'q2', order: 1 },
  ],
  poems: [
    {
      id: 'p1', round_id: 'r1', poet: '김하늘', title: '봄의 기억', order: 0,
      body: '봄이 오면 나는 늘\n창문 하나를 더 열어두었다\n\n바람이 커튼을 밀어내고\n그 틈으로 햇빛이 들어와\n방 안 가득 쌓인 먼지들을\n하나씩 들어 올리던 날\n\n너는 그 먼지들 사이에 있었다',
    },
    { id: 'p2', round_id: 'r1', poet: '이서준', title: '연두색 오후', order: 1, body: '연두색이 번지던 오후\n나는 창가에 앉아\n아무것도 하지 않았다\n\n그게 가장 봄다운 일이었다' },
    { id: 'p3', round_id: 'r2', poet: '박지유', title: '여름 끝에서', order: 0, body: '여름은 늘 너무 갑자기 끝난다\n분명 뜨거웠는데\n어느 날 보면 이미 식어있어\n\n우리가 그랬던 것처럼' },
    { id: 'p4', round_id: 'r3', poet: '최민아', title: '처음 본 얼굴', order: 0, body: '처음 본 얼굴인데\n어딘가 낯이 익었다\n\n아마도 내가 오래\n기다려온 얼굴이라서' },
    { id: 'p5', round_id: 'r4', poet: '정우찬', title: '이별의 문법', order: 0, body: '이별에도 문법이 있다면\n주어는 언제나 둘이고\n동사는 언제나 하나다\n\n우리는 같은 문장을\n다른 시제로 읽었다' },
  ],
  freePoems: [
    { id: 'f1', quarter_id: 'q1', poet: '오하린', title: '여백', order: 0, body: '아무것도 쓰지 않은 페이지가\n가장 많은 말을 한다' },
  ],
}

type View = 'cover' | 'toc' | 'book' | 'edit'
type TabName = 'quarters' | 'rounds' | 'poems' | 'free'
type PageItem = { type: string; id: string; [key: string]: unknown }

function loadSnapshot() {
  try {
    const r = localStorage.getItem(SNAPSHOT_KEY)
    return r ? JSON.parse(r) : null
  } catch { return null }
}
function saveSnapshot(q: Quarter[], r: Round[], p: Poem[], f: FreePoem[]) {
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ quarters: q, rounds: r, poems: p, freePoems: f, ts: Date.now() })) } catch { }
}

export default function SihwaApp() {
  const [loading, setLoading] = useState(true)
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [poems, setPoems] = useState<Poem[]>([])
  const [freePoems, setFreePoems] = useState<FreePoem[]>([])

  const [currentView, setCurrentView] = useState<View>('cover')
  const [viewMode, setViewMode] = useState<'scroll' | 'page'>('scroll')
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<TabName>('quarters')

  // Page view
  const [pageItems, setPageItems] = useState<PageItem[]>([])
  const [currentPageIdx, setCurrentPageIdx] = useState(0)

  // Modals
  const [showPwModal, setShowPwModal] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)

  const [showQuarterModal, setShowQuarterModal] = useState(false)
  const [editingQuarterId, setEditingQuarterId] = useState<string | null>(null)
  const [qTitle, setQTitle] = useState('')
  const [qIntro, setQIntro] = useState('')
  const [qOrder, setQOrder] = useState(0)

  const [showRoundModal, setShowRoundModal] = useState(false)
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [rQuarterId, setRQuarterId] = useState('')
  const [rNum, setRNum] = useState(1)
  const [rTitle, setRTitle] = useState('')
  const [rOrder, setROrder] = useState(0)

  const [showPoemModal, setShowPoemModal] = useState(false)
  const [editingPoemId, setEditingPoemId] = useState<string | null>(null)
  const [editingFreePoemId, setEditingFreePoemId] = useState<string | null>(null)
  const [pType, setPType] = useState<'round' | 'free'>('round')
  const [pRoundId, setPRoundId] = useState('')
  const [pQuarterId, setPQuarterId] = useState('')
  const [pPoet, setPPoet] = useState('')
  const [pTitle, setPTitle] = useState('')
  const [pBody, setPBody] = useState('')
  const [pOrder, setPOrder] = useState(0)

  const [showDelModal, setShowDelModal] = useState(false)
  const [deletingType, setDeletingType] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState('')

  const [filterRoundQuarter, setFilterRoundQuarter] = useState('')
  const [filterPoemQuarter, setFilterPoemQuarter] = useState('')
  const [filterPoemRound, setFilterPoemRound] = useState('')

  const pwInputRef = useRef<HTMLInputElement>(null)
  const qTitleRef = useRef<HTMLInputElement>(null)
  const rTitleRef = useRef<HTMLInputElement>(null)
  const pPoetRef = useRef<HTMLInputElement>(null)

  // Helpers
  const getRoundsOf = useCallback((qid: string) =>
    rounds.filter(r => r.quarter_id === qid).sort((a, b) => a.order - b.order), [rounds])
  const getPoemsOf = useCallback((rid: string) =>
    poems.filter(p => p.round_id === rid).sort((a, b) => a.order - b.order), [poems])
  const getFreeOf = useCallback((qid: string) =>
    freePoems.filter(f => f.quarter_id === qid).sort((a, b) => a.order - b.order), [freePoems])

  // Load data
  const loadAll = useCallback(async () => {
    try {
      const [qSnap, rSnap, pSnap, fSnap] = await Promise.all([
        getDocs(query(collection(db, 'quarters'), orderBy('order'))),
        getDocs(query(collection(db, 'rounds'), orderBy('order'))),
        getDocs(query(collection(db, 'poems'), orderBy('order'))),
        getDocs(query(collection(db, 'free_poems'), orderBy('order'))),
      ])
      const q = qSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Quarter[]
      const r = rSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Round[]
      const p = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Poem[]
      const f = fSnap.docs.map(d => ({ id: d.id, ...d.data() })) as FreePoem[]
      if (q.length || p.length) {
        setQuarters(q); setRounds(r); setPoems(p); setFreePoems(f)
        saveSnapshot(q, r, p, f)
      }
    } catch { /* Firebase 미연결 시 스냅샷/샘플 사용 */ }
  }, [])

  useEffect(() => {
    const snap = loadSnapshot()
    if (snap && snap.quarters?.length) {
      setQuarters(snap.quarters)
      setRounds(snap.rounds || [])
      setPoems(snap.poems || [])
      setFreePoems(snap.freePoems || [])
      setLoading(false)
      loadAll()
    } else {
      loadAll().then(() => {
        setQuarters(q => q.length ? q : SAMPLE.quarters)
        setRounds(r => r.length ? r : SAMPLE.rounds)
        setPoems(p => p.length ? p : SAMPLE.poems)
        setFreePoems(f => f.length ? f : SAMPLE.freePoems)
        setLoading(false)
      })
    }
  }, [loadAll])

  // Build page items for page view
  const buildPageItems = useCallback((q: Quarter[], r: Round[], p: Poem[], f: FreePoem[]) => {
    const items: PageItem[] = []
    q.sort((a, b) => a.order - b.order).forEach(quarter => {
      const qRounds = r.filter(x => x.quarter_id === quarter.id).sort((a, b) => a.order - b.order)
      const hasPoems = qRounds.some(round => p.some(poem => poem.round_id === round.id))
      const hasFree = f.some(fp => fp.quarter_id === quarter.id)
      if (!hasPoems && !hasFree) return
      items.push({ type: 'quarter', id: quarter.id, quarter })
      if (quarter.intro) items.push({ type: 'quarter-intro', id: `intro-${quarter.id}`, quarter })
      qRounds.forEach(round => {
        const rPoems = p.filter(x => x.round_id === round.id).sort((a, b) => a.order - b.order)
        if (!rPoems.length) return
        items.push({ type: 'round', id: round.id, round, quarter })
        rPoems.forEach(poem => items.push({ type: 'poem', id: poem.id, poem, round, quarter }))
      })
      const fPoems = f.filter(x => x.quarter_id === quarter.id).sort((a, b) => a.order - b.order)
      if (fPoems.length) {
        items.push({ type: 'free-section', id: `free-${quarter.id}`, quarter })
        fPoems.forEach(fp => items.push({ type: 'free-poem', id: fp.id, freePoem: fp, quarter }))
      }
    })
    return items
  }, [])

  useEffect(() => {
    if (currentView === 'book' && viewMode === 'page') {
      const items = buildPageItems(quarters, rounds, poems, freePoems)
      setPageItems(items)
    }
  }, [currentView, viewMode, quarters, rounds, poems, freePoems, buildPageItems])

  // Jump to poem in scroll view
  const jumpTo = (poemId: string) => {
    showView('book')
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${poemId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // View management
  const showView = (name: View) => {
    setCurrentView(name)
    if (name !== 'book') window.scrollTo({ top: 0 })
  }

  const tryEditMode = () => {
    if (editMode) { setEditMode(false); showView('cover'); return }
    setPwInput(''); setPwError(false); setShowPwModal(true)
    setTimeout(() => pwInputRef.current?.focus(), 100)
  }

  const checkPassword = () => {
    if (pwInput === EDIT_PASSWORD) {
      setShowPwModal(false); setEditMode(true); showView('edit')
    } else {
      setPwError(true)
    }
  }

  // Quarter CRUD
  const openQuarterModal = (id?: string) => {
    setEditingQuarterId(id || null)
    if (id) {
      const q = quarters.find(x => x.id === id)!
      setQTitle(q.title); setQIntro(q.intro || ''); setQOrder(q.order)
    } else {
      setQTitle(''); setQIntro(''); setQOrder(quarters.length)
    }
    setShowQuarterModal(true)
    setTimeout(() => qTitleRef.current?.focus(), 100)
  }

  const saveQuarter = async () => {
    if (!qTitle.trim()) { alert('대주제를 입력해주세요.'); return }
    const data = { title: qTitle.trim(), intro: qIntro.trim(), order: qOrder }
    try {
      if (editingQuarterId) {
        await updateDoc(doc(db, 'quarters', editingQuarterId), data)
      } else {
        await addDoc(collection(db, 'quarters'), data)
      }
      setShowQuarterModal(false); await loadAll()
    } catch { alert('저장 실패: Firebase 설정을 확인해주세요.') }
  }

  // Round CRUD
  const openRoundModal = (id?: string) => {
    if (!quarters.length) { alert('분기를 먼저 만들어주세요.'); return }
    setEditingRoundId(id || null)
    if (id) {
      const r = rounds.find(x => x.id === id)!
      setRQuarterId(r.quarter_id); setRNum(r.num); setRTitle(r.title); setROrder(r.order)
    } else {
      setRQuarterId(quarters[0].id); setRNum(rounds.length + 1); setRTitle(''); setROrder(rounds.length)
    }
    setShowRoundModal(true)
    setTimeout(() => rTitleRef.current?.focus(), 100)
  }

  const saveRound = async () => {
    if (!rTitle.trim()) { alert('회차 시제를 입력해주세요.'); return }
    const data = { quarter_id: rQuarterId, num: rNum, title: rTitle.trim(), order: rOrder }
    try {
      if (editingRoundId) {
        await updateDoc(doc(db, 'rounds', editingRoundId), data)
      } else {
        await addDoc(collection(db, 'rounds'), data)
      }
      setShowRoundModal(false); await loadAll()
    } catch { alert('저장 실패') }
  }

  // Poem CRUD
  const openPoemModal = (id?: string) => {
    if (!rounds.length) { alert('회차를 먼저 만들어주세요.'); return }
    setEditingPoemId(id || null); setEditingFreePoemId(null)
    setPType('round')
    if (id) {
      const p = poems.find(x => x.id === id)!
      setPRoundId(p.round_id); setPPoet(p.poet); setPTitle(p.title); setPBody(p.body); setPOrder(p.order)
    } else {
      setPRoundId(rounds[0].id); setPPoet(''); setPTitle(''); setPBody(''); setPOrder(poems.length)
    }
    setShowPoemModal(true)
    setTimeout(() => pPoetRef.current?.focus(), 100)
  }

  const openFreePoemModal = (id?: string) => {
    if (!quarters.length) { alert('분기를 먼저 만들어주세요.'); return }
    setEditingFreePoemId(id || null); setEditingPoemId(null)
    setPType('free')
    if (id) {
      const f = freePoems.find(x => x.id === id)!
      setPQuarterId(f.quarter_id); setPPoet(f.poet); setPTitle(f.title); setPBody(f.body); setPOrder(f.order)
    } else {
      setPQuarterId(quarters[0].id); setPPoet(''); setPTitle(''); setPBody(''); setPOrder(freePoems.length)
    }
    setShowPoemModal(true)
    setTimeout(() => pPoetRef.current?.focus(), 100)
  }

  const savePoem = async () => {
    if (!pPoet.trim() || !pTitle.trim() || !pBody.trim()) { alert('시인, 제목, 본문은 필수입니다.'); return }
    try {
      if (pType === 'free') {
        const data = { quarter_id: pQuarterId, poet: pPoet.trim(), title: pTitle.trim(), body: pBody, order: pOrder }
        if (editingFreePoemId) await updateDoc(doc(db, 'free_poems', editingFreePoemId), data)
        else await addDoc(collection(db, 'free_poems'), data)
      } else {
        const data = { round_id: pRoundId, poet: pPoet.trim(), title: pTitle.trim(), body: pBody, order: pOrder }
        if (editingPoemId) await updateDoc(doc(db, 'poems', editingPoemId), data)
        else await addDoc(collection(db, 'poems'), data)
      }
      setShowPoemModal(false); await loadAll()
    } catch { alert('저장 실패') }
  }

  // Delete
  const openDelModal = (type: string, id: string, name: string) => {
    setDeletingType(type); setDeletingId(id); setDeletingName(name); setShowDelModal(true)
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    const tbl = deletingType === 'quarter' ? 'quarters' : deletingType === 'round' ? 'rounds' : deletingType === 'freePoem' ? 'free_poems' : 'poems'
    try {
      await deleteDoc(doc(db, tbl, deletingId))
      setShowDelModal(false); setDeletingType(null); setDeletingId(null)
      await loadAll()
    } catch { alert('삭제 실패') }
  }

  // Rendered cover poets
  const coverPoets = [...new Set(poems.map(p => p.poet))].join(' · ')

  // TOC render data
  const tocQuarters = quarters.filter(q => {
    const qRounds = getRoundsOf(q.id)
    return qRounds.some(r => getPoemsOf(r.id).length > 0)
  }).sort((a, b) => a.order - b.order)

  // Current page item
  const currentItem = pageItems[currentPageIdx]

  const getPageLabel = (item: PageItem) => {
    if (!item) return ''
    if (item.type === 'poem' || item.type === 'free-poem') {
      const q = item.quarter as Quarter
      return q?.title || ''
    }
    if (item.type === 'round') {
      const r = item.round as Round
      return r ? `${r.num}회차 — ${r.title}` : ''
    }
    return ''
  }

  // Filter helpers for edit
  const filteredRounds = filterRoundQuarter ? rounds.filter(r => r.quarter_id === filterRoundQuarter) : rounds
  const filteredPoems = (() => {
    let p = poems
    if (filterPoemQuarter) {
      const qRounds = rounds.filter(r => r.quarter_id === filterPoemQuarter).map(r => r.id)
      p = p.filter(x => qRounds.includes(x.round_id))
    }
    if (filterPoemRound) p = p.filter(x => x.round_id === filterPoemRound)
    return p
  })()
  const filteredFreePoems = filterPoemQuarter ? freePoems.filter(f => f.quarter_id === filterPoemQuarter) : freePoems

  if (loading) {
    return (
      <div id="loading" style={{ position: 'fixed', inset: 0, background: '#fdf4e7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 400, color: '#6b5a42', letterSpacing: '0.15em', marginBottom: '1.5rem', fontFamily: "'Noto Serif KR', serif" }}>
          글빛을 모아 담다 시화 詩和
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8a06a', display: 'inline-block', animation: `bounce 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`sihwa-root${editMode ? ' edit-mode' : ''}`}>
      {/* TOP BAR */}
      <div id="topbar">
        <div className="tb-title">시화 詩和</div>
        <button className={`tb-btn${currentView === 'toc' ? ' active' : ''}`} onClick={() => showView('toc')}>차례</button>
        <button className={`tb-btn${currentView === 'book' ? ' active' : ''}`} onClick={() => showView('book')}>읽기</button>
        <button className={`tb-btn${editMode ? ' active' : ''}`} onClick={tryEditMode}>편집</button>
      </div>

      <div id="main">
        {/* COVER */}
        <div id="cover" style={{ display: currentView === 'cover' ? 'flex' : 'none' }}>
          <div className="cover-ornament">✦ ✦ ✦</div>
          <div className="cover-main-title">글빛을 모아 담다 시화 詩和</div>
          <div className="cover-poets">{coverPoets || '시인을 불러오는 중...'}</div>
          <div className="cover-year">2026</div>
          <button className="cover-start-btn" onClick={() => showView('toc')}>차례 보기</button>
        </div>

        {/* TOC */}
        <div id="toc-view" className={currentView === 'toc' ? 'active' : ''}>
          <div className="toc-header">차 례</div>
          <div id="toc-body">
            {tocQuarters.map((q, qi) => {
              const qRounds = getRoundsOf(q.id)
              return (
                <div key={q.id} className="toc-quarter">
                  <div className="toc-quarter-label">
                    <span className="toc-quarter-num">{qi + 1}분기</span>{q.title}
                  </div>
                  {qRounds.map(r => {
                    const rPoems = getPoemsOf(r.id)
                    if (!rPoems.length) return null
                    return (
                      <div key={r.id} className="toc-round">
                        <div className="toc-round-label">{r.num}회차 — {r.title}</div>
                        {rPoems.map(p => (
                          <div key={p.id} className="toc-item" onClick={() => jumpTo(p.id)}>
                            <span className="toc-item-title">{p.title}</span>
                            <span className="toc-item-poet">{p.poet}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {tocQuarters.length === 0 && <div style={{ color: 'var(--ink-lite)', fontFamily: "'Noto Sans KR', sans-serif", fontSize: '0.8rem', padding: '2rem', textAlign: 'center' }}>아직 등록된 시가 없어요.</div>}
          </div>
        </div>

        {/* BOOK VIEW (scroll) */}
        <div id="book-view" className={currentView === 'book' && viewMode === 'scroll' ? 'active' : ''}>
          <div id="book-body">
            {quarters.sort((a, b) => a.order - b.order).map((q, qi) => {
              const qRounds = getRoundsOf(q.id)
              const hasPoems = qRounds.some(r => getPoemsOf(r.id).length > 0)
              const fPoems = getFreeOf(q.id)
              if (!hasPoems && !fPoems.length) return null
              return (
                <div key={q.id}>
                  <div className="quarter-page">
                    <div className="quarter-page-num">{qi + 1}분기</div>
                    <div className="quarter-page-title">{q.title}</div>
                  </div>
                  {q.intro && <div className="quarter-intro"><div className="quarter-intro-body">{q.intro}</div></div>}
                  {qRounds.map(r => {
                    const rPoems = getPoemsOf(r.id)
                    if (!rPoems.length) return null
                    return (
                      <div key={r.id}>
                        <div className="round-page">
                          <div className="round-page-num">{r.num}회차</div>
                          <div className="round-page-title">{r.title}</div>
                        </div>
                        {rPoems.map(p => (
                          <div key={p.id} className="poem-entry" data-id={p.id}>
                            <div className="poem-entry-poet">{p.poet}</div>
                            <div className="poem-entry-title">{p.title}</div>
                            <div className="poem-entry-divider" />
                            <div className="poem-entry-body">{p.body}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {fPoems.length > 0 && (
                    <div>
                      <div className="free-section-page">
                        <div className="free-section-page-label">자유시</div>
                        <div className="free-section-page-title">{q.title}</div>
                      </div>
                      {fPoems.map(fp => (
                        <div key={fp.id} className="poem-entry" data-id={fp.id}>
                          <div className="poem-entry-poet">{fp.poet}</div>
                          <div className="poem-entry-title">{fp.title}</div>
                          <div className="poem-entry-divider" />
                          <div className="poem-entry-body">{fp.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="end-page">
            <div className="end-ornament">✦</div>
            <div className="end-title">글빛을 모아 담다 시화 詩和</div>
            <div className="end-sub">끝</div>
          </div>
        </div>

        {/* PAGE VIEW (card) */}
        <div id="page-view" className={currentView === 'book' && viewMode === 'page' ? 'active' : ''}>
          <div id="page-card-container">
            {!pageItems.length ? (
              <div className="page-card"><div className="page-card-type">아직 등록된 시가 없어요.</div></div>
            ) : currentItem ? (
              <div className="page-card">
                {currentItem.type === 'quarter' && (() => {
                  const q = currentItem.quarter as Quarter
                  const qi = quarters.sort((a, b) => a.order - b.order).findIndex(x => x.id === q.id)
                  return <>
                    <div className="page-card-quarter-num">{qi + 1}분기</div>
                    <div className="page-card-quarter-title">{q.title}</div>
                  </>
                })()}
                {currentItem.type === 'quarter-intro' && (() => {
                  const q = currentItem.quarter as Quarter
                  return <div className="page-card-intro">{q.intro}</div>
                })()}
                {currentItem.type === 'round' && (() => {
                  const r = currentItem.round as Round
                  return <>
                    <div className="page-card-round-num">{r.num}회차</div>
                    <div className="page-card-round-title">{r.title}</div>
                  </>
                })()}
                {(currentItem.type === 'poem' || currentItem.type === 'free-poem') && (() => {
                  const p = (currentItem.poem || currentItem.freePoem) as Poem | FreePoem
                  return <>
                    <div className="page-card-type">{p.poet}</div>
                    <div className="page-card-title">{p.title}</div>
                    <div className="page-card-divider" />
                    <div className="page-card-body">{p.body}</div>
                  </>
                })()}
                {currentItem.type === 'free-section' && (() => {
                  const q = currentItem.quarter as Quarter
                  return <>
                    <div className="page-card-type">자유시</div>
                    <div className="page-card-round-title">{q.title}</div>
                  </>
                })()}
                <div className="page-counter" style={{ marginTop: '2rem' }}>
                  {currentPageIdx + 1} / {pageItems.length}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* EDIT PANEL */}
        <div id="edit-panel" className={currentView === 'edit' ? 'active' : ''}>
          <div className="supabase-notice">
            <strong>Supabase 연결</strong> — <code>.env.local</code>에 <code>NEXT_PUBLIC_SUPABASE_URL</code>과 <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를 설정하세요.
            테이블: <code>quarters</code> · <code>rounds</code> · <code>poems</code> · <code>free_poems</code>
          </div>
          <div className="edit-tabs">
            {(['quarters', 'rounds', 'poems', 'free'] as TabName[]).map(t => (
              <button key={t} className={`edit-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
                {{ quarters: '분기 관리', rounds: '회차 관리', poems: '시 관리', free: '자유시' }[t]}
              </button>
            ))}
          </div>

          {/* 분기 탭 */}
          {activeTab === 'quarters' && (
            <div>
              <div className="edit-section-header">
                <div className="edit-section-title">분기 목록</div>
                <button className="edit-add-btn" onClick={() => openQuarterModal()}>+ 분기 추가</button>
              </div>
              {quarters.sort((a, b) => a.order - b.order).map(q => (
                <div key={q.id} className="edit-card">
                  <div className="edit-card-info">
                    <div className="edit-card-title">{q.title}</div>
                    <div className="edit-card-sub">순서 {q.order}</div>
                    {q.intro && <div className="edit-card-preview">{q.intro}</div>}
                  </div>
                  <div className="edit-card-actions">
                    <button className="ecard-btn" onClick={() => openQuarterModal(q.id)}>수정</button>
                    <button className="ecard-btn del" onClick={() => openDelModal('quarter', q.id, q.title)}>삭제</button>
                  </div>
                </div>
              ))}
              {!quarters.length && <div className="empty-state">분기가 없어요. 분기를 먼저 추가해주세요.</div>}
            </div>
          )}

          {/* 회차 탭 */}
          {activeTab === 'rounds' && (
            <div>
              <div className="edit-section-header">
                <div className="edit-section-title">회차 목록</div>
                <button className="edit-add-btn" onClick={() => openRoundModal()}>+ 회차 추가</button>
              </div>
              <div className="filter-bar">
                <select className="filter-select" value={filterRoundQuarter} onChange={e => setFilterRoundQuarter(e.target.value)}>
                  <option value="">전체 분기</option>
                  {quarters.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </div>
              {filteredRounds.sort((a, b) => a.order - b.order).map(r => {
                const q = quarters.find(x => x.id === r.quarter_id)
                return (
                  <div key={r.id} className="edit-card">
                    <div className="edit-card-info">
                      <div className="edit-card-title">{r.num}회차 — {r.title}</div>
                      <div className="edit-card-sub">{q?.title || ''} · 순서 {r.order}</div>
                    </div>
                    <div className="edit-card-actions">
                      <button className="ecard-btn" onClick={() => openRoundModal(r.id)}>수정</button>
                      <button className="ecard-btn del" onClick={() => openDelModal('round', r.id, r.title)}>삭제</button>
                    </div>
                  </div>
                )
              })}
              {!filteredRounds.length && <div className="empty-state">회차가 없어요.</div>}
            </div>
          )}

          {/* 시 탭 */}
          {activeTab === 'poems' && (
            <div>
              <div className="edit-section-header">
                <div className="edit-section-title">시 목록</div>
                <button className="edit-add-btn" onClick={() => openPoemModal()}>+ 시 추가</button>
              </div>
              <div className="filter-bar">
                <select className="filter-select" value={filterPoemQuarter} onChange={e => { setFilterPoemQuarter(e.target.value); setFilterPoemRound('') }}>
                  <option value="">전체 분기</option>
                  {quarters.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
                <select className="filter-select" value={filterPoemRound} onChange={e => setFilterPoemRound(e.target.value)}>
                  <option value="">전체 회차</option>
                  {(filterPoemQuarter ? rounds.filter(r => r.quarter_id === filterPoemQuarter) : rounds)
                    .map(r => <option key={r.id} value={r.id}>{r.num}회차 — {r.title}</option>)}
                </select>
              </div>
              {filteredPoems.sort((a, b) => a.order - b.order).map(p => {
                const r = rounds.find(x => x.id === p.round_id)
                return (
                  <div key={p.id} className="edit-card">
                    <div className="edit-card-info">
                      <div className="edit-card-title">{p.title}</div>
                      <div className="edit-card-sub">{p.poet} · {r?.title || ''}</div>
                      <div className="edit-card-preview">{p.body.slice(0, 60)}</div>
                    </div>
                    <div className="edit-card-actions">
                      <button className="ecard-btn" onClick={() => openPoemModal(p.id)}>수정</button>
                      <button className="ecard-btn del" onClick={() => openDelModal('poem', p.id, p.title)}>삭제</button>
                    </div>
                  </div>
                )
              })}
              {!filteredPoems.length && <div className="empty-state">시가 없어요.</div>}
            </div>
          )}

          {/* 자유시 탭 */}
          {activeTab === 'free' && (
            <div>
              <div className="edit-section-header">
                <div className="edit-section-title">자유시 목록</div>
                <button className="edit-add-btn" onClick={() => openFreePoemModal()}>+ 자유시 추가</button>
              </div>
              {filteredFreePoems.sort((a, b) => a.order - b.order).map(f => {
                const q = quarters.find(x => x.id === f.quarter_id)
                return (
                  <div key={f.id} className="edit-card">
                    <div className="edit-card-info">
                      <div className="edit-card-title">{f.title}</div>
                      <div className="edit-card-sub">{f.poet} · {q?.title || ''}</div>
                      <div className="edit-card-preview">{f.body.slice(0, 60)}</div>
                    </div>
                    <div className="edit-card-actions">
                      <button className="ecard-btn" onClick={() => openFreePoemModal(f.id)}>수정</button>
                      <button className="ecard-btn del" onClick={() => openDelModal('freePoem', f.id, f.title)}>삭제</button>
                    </div>
                  </div>
                )
              })}
              {!filteredFreePoems.length && <div className="empty-state">자유시가 없어요.</div>}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM NAV */}
      {currentView === 'book' && (
        <div id="bottom-nav" className="active">
          <button className="bnav-btn" disabled={currentPageIdx <= 0}
            onClick={() => setCurrentPageIdx(i => Math.max(0, i - 1))}>← 이전</button>
          <div id="page-indicator">{getPageLabel(currentItem)}</div>
          <button className="bnav-btn" disabled={currentPageIdx >= pageItems.length - 1}
            onClick={() => setCurrentPageIdx(i => Math.min(pageItems.length - 1, i + 1))}>다음 →</button>
        </div>
      )}

      {/* VIEW TOGGLE */}
      {currentView === 'book' && (
        <div className="view-toggle">
          <button className={`view-toggle-btn${viewMode === 'scroll' ? ' active' : ''}`} id="vt-scroll"
            onClick={() => setViewMode('scroll')}>스크롤</button>
          <button className={`view-toggle-btn${viewMode === 'page' ? ' active' : ''}`} id="vt-page"
            onClick={() => setViewMode('page')}>페이지</button>
        </div>
      )}

      {/* PASSWORD MODAL */}
      {showPwModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowPwModal(false)}>
          <div id="pw-modal" className="modal-box" style={{ background: 'var(--cream2)', borderColor: 'var(--border)' }}>
            <div className="modal-title" style={{ color: 'var(--ink-mid)' }}>편집 모드</div>
            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input ref={pwInputRef} type="password" className="form-input" placeholder="••••••••"
                style={{ background: 'var(--cream)', borderColor: 'var(--border)', color: 'var(--ink)', fontFamily: "'Noto Sans KR', sans-serif" }}
                value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(false) }}
                onKeyDown={e => e.key === 'Enter' && checkPassword()} />
              {pwError && <div className="pw-error show">비밀번호가 맞지 않아요</div>}
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" style={{ color: 'var(--ink-lite)', borderColor: 'var(--border)' }} onClick={() => setShowPwModal(false)}>취소</button>
              <button className="modal-btn confirm" style={{ background: 'var(--ink)', color: 'var(--cream)' }} onClick={checkPassword}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* QUARTER MODAL */}
      {showQuarterModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowQuarterModal(false)}>
          <div className="modal-box">
            <div className="modal-title">{editingQuarterId ? '분기 수정' : '분기 추가'}</div>
            <div className="form-group">
              <label className="form-label">대주제</label>
              <input ref={qTitleRef} type="text" className="form-input" placeholder="예: 계절" value={qTitle} onChange={e => setQTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">소개글 (선택)</label>
              <textarea className="form-textarea" style={{ minHeight: 80 }} placeholder="분기 소개글" value={qIntro} onChange={e => setQIntro(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">순서</label>
              <input type="number" className="form-input" value={qOrder} onChange={e => setQOrder(parseInt(e.target.value) || 0)} />
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowQuarterModal(false)}>취소</button>
              <button className="modal-btn confirm" onClick={saveQuarter}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ROUND MODAL */}
      {showRoundModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowRoundModal(false)}>
          <div className="modal-box">
            <div className="modal-title">{editingRoundId ? '회차 수정' : '회차 추가'}</div>
            <div className="form-group">
              <label className="form-label">분기</label>
              <select className="form-select" value={rQuarterId} onChange={e => setRQuarterId(e.target.value)}>
                {quarters.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">회차 번호</label>
              <input type="number" className="form-input" value={rNum} onChange={e => setRNum(parseInt(e.target.value) || 1)} />
            </div>
            <div className="form-group">
              <label className="form-label">시제</label>
              <input ref={rTitleRef} type="text" className="form-input" placeholder="예: 봄" value={rTitle} onChange={e => setRTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">순서</label>
              <input type="number" className="form-input" value={rOrder} onChange={e => setROrder(parseInt(e.target.value) || 0)} />
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowRoundModal(false)}>취소</button>
              <button className="modal-btn confirm" onClick={saveRound}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* POEM MODAL */}
      {showPoemModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowPoemModal(false)}>
          <div className="modal-box">
            <div className="modal-title">{editingPoemId ? '시 수정' : editingFreePoemId ? '자유시 수정' : pType === 'free' ? '자유시 추가' : '시 추가'}</div>
            {!editingPoemId && !editingFreePoemId && (
              <div className="form-group">
                <label className="form-label">유형</label>
                <select className="form-select" value={pType} onChange={e => setPType(e.target.value as 'round' | 'free')}>
                  <option value="round">회차 시</option>
                  <option value="free">자유시</option>
                </select>
              </div>
            )}
            {pType === 'round' ? (
              <div className="form-group">
                <label className="form-label">회차</label>
                <select className="form-select" value={pRoundId} onChange={e => setPRoundId(e.target.value)}>
                  {quarters.map(q => {
                    const qr = rounds.filter(r => r.quarter_id === q.id)
                    if (!qr.length) return null
                    return <optgroup key={q.id} label={q.title}>
                      {qr.map(r => <option key={r.id} value={r.id}>{r.num}회차 — {r.title}</option>)}
                    </optgroup>
                  })}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">분기</label>
                <select className="form-select" value={pQuarterId} onChange={e => setPQuarterId(e.target.value)}>
                  {quarters.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">시인</label>
              <input ref={pPoetRef} type="text" className="form-input" placeholder="시인 이름" value={pPoet} onChange={e => setPPoet(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">제목</label>
              <input type="text" className="form-input" placeholder="시 제목" value={pTitle} onChange={e => setPTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">본문</label>
              <textarea className="form-textarea" placeholder="시 내용 (줄바꿈 그대로 입력)" value={pBody} onChange={e => setPBody(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">순서</label>
              <input type="number" className="form-input" value={pOrder} onChange={e => setPOrder(parseInt(e.target.value) || 0)} />
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowPoemModal(false)}>취소</button>
              <button className="modal-btn confirm" onClick={savePoem}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowDelModal(false)}>
          <div className="modal-box">
            <div className="modal-title">삭제 확인</div>
            <p style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: '0.82rem', color: 'var(--edit-text)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              <strong style={{ color: '#e8b870' }}>{deletingName}</strong>을(를) 삭제할까요? 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowDelModal(false)}>취소</button>
              <button className="modal-btn" style={{ background: '#7a3030', border: 'none', color: '#ffd0d0' }} onClick={confirmDelete}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

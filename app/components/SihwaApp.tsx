'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { db, storage, auth, Quarter, Round, Poem, FreePoem, GalleryItem } from '@/lib/firebase'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { CoverProvider, useCoverContext, type CoverKey } from './CoverContext'
import Book from './Book'
import { buildBookPages, type PageItem } from '@/lib/bookData'
import type { BookSourceData } from './BookPages'
import { TocSidebar } from './TocSidebar'
import OnboardingPopup from './OnboardingPopup'
import {
  safeImageUrl,
  validateImageFile,
  filterValid,
  isQuarter,
  isRound,
  isPoem,
  isFreePoem,
  isGalleryItem,
} from '@/lib/validation'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''
const SNAPSHOT_KEY = 'sihwa_snapshot'
const READ_IDX_KEY_SINGLE = 'sihwa_read_idx_single_v2'
const READ_IDX_KEY_SPREAD = 'sihwa_read_idx_spread_v2'
const OLD_READ_IDX_KEY_SINGLE = 'sihwa_read_idx_single'  // legacy (pre-chunk-removal)
const OLD_READ_IDX_KEY_SPREAD = 'sihwa_read_idx_spread'  // legacy (pre-chunk-removal)

const SAMPLE: { quarters: Quarter[]; rounds: Round[]; poems: Poem[]; freePoems: FreePoem[] } = {
  quarters: [
    { id: 'q1', title: '계절', intro: '계절은 늘 우리보다 먼저\n도착해 있었다', order: 0 },
    { id: 'q2', title: '관계', order: 1 },
  ],
  rounds: [
    { id: 'r1', title: '봄', num: 1, quarterId: 'q1', order: 0 },
    { id: 'r2', title: '여름', num: 2, quarterId: 'q1', order: 1 },
    { id: 'r3', title: '처음', num: 3, quarterId: 'q2', order: 0 },
    { id: 'r4', title: '이별', num: 4, quarterId: 'q2', order: 1 },
  ],
  poems: [
    {
      id: 'p1', roundId: 'r1', poet: '김하늘', title: '봄의 기억', order: 0,
      body: '봄이 오면 나는 늘\n창문 하나를 더 열어두었다\n\n바람이 커튼을 밀어내고\n그 틈으로 햇빛이 들어와\n방 안 가득 쌓인 먼지들을\n하나씩 들어 올리던 날\n\n너는 그 먼지들 사이에 있었다',
    },
    { id: 'p2', roundId: 'r1', poet: '이서준', title: '연두색 오후', order: 1, body: '연두색이 번지던 오후\n나는 창가에 앉아\n아무것도 하지 않았다\n\n그게 가장 봄다운 일이었다' },
    { id: 'p3', roundId: 'r2', poet: '박지유', title: '여름 끝에서', order: 0, body: '여름은 늘 너무 갑자기 끝난다\n분명 뜨거웠는데\n어느 날 보면 이미 식어있어\n\n우리가 그랬던 것처럼' },
    { id: 'p4', roundId: 'r3', poet: '최민아', title: '처음 본 얼굴', order: 0, body: '처음 본 얼굴인데\n어딘가 낯이 익었다\n\n아마도 내가 오래\n기다려온 얼굴이라서' },
    { id: 'p5', roundId: 'r4', poet: '정우찬', title: '이별의 문법', order: 0, body: '이별에도 문법이 있다면\n주어는 언제나 둘이고\n동사는 언제나 하나다\n\n우리는 같은 문장을\n다른 시제로 읽었다' },
  ],
  freePoems: [
    { id: 'f1', quarterId: 'q1', poet: '오하린', title: '여백', order: 0, body: '아무것도 쓰지 않은 페이지가\n가장 많은 말을 한다' },
  ],
}

type View = 'cover' | 'book' | 'gallery' | 'edit'
type TabName = 'quarters' | 'rounds' | 'poems' | 'free' | 'gallery' | 'covers'

function loadSnapshot() {
  try {
    const r = localStorage.getItem(SNAPSHOT_KEY)
    return r ? JSON.parse(r) : null
  } catch { return null }
}
function saveSnapshot(q: Quarter[], r: Round[], p: Poem[], f: FreePoem[]) {
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ quarters: q, rounds: r, poems: p, freePoems: f, ts: Date.now() })) } catch { }
}

function SihwaAppInner() {
  const cover = useCoverContext()

  const initialSnap = useMemo(() => {
    if (typeof window === 'undefined') return null
    return loadSnapshot()
  }, [])

  const [loading, setLoading] = useState(() => !(initialSnap && initialSnap.quarters?.length))
  const [quarters, setQuarters] = useState<Quarter[]>(() => initialSnap?.quarters || [])
  const [rounds, setRounds] = useState<Round[]>(() => initialSnap?.rounds || [])
  const [poems, setPoems] = useState<Poem[]>(() => initialSnap?.poems || [])
  const [freePoems, setFreePoems] = useState<FreePoem[]>(() => initialSnap?.freePoems || [])
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])

  const [currentView, setCurrentView] = useState<View>('cover')
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<TabName>('quarters')

  // Book viewer state
  const [mode, setMode] = useState<'single' | 'spread'>('single')
  const [isWide, setIsWide] = useState(false)
  const [bookIdx, setBookIdx] = useState(0)
  const [forcedIdx, setForcedIdx] = useState<number | undefined>(undefined)
  const [forceJumpToken, setForceJumpToken] = useState(0)

  // PE-4: TOC sidebar visibility. Default false (SSR-safe); sync to isWide
  // once on the client so PC opens the sidebar by default while mobile keeps
  // it closed until the user taps the bottom tabbar.
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)

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

  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null)

  const [showGalleryModal, setShowGalleryModal] = useState(false)
  const [editingGalleryId, setEditingGalleryId] = useState<string | null>(null)
  const [gQuarterId, setGQuarterId] = useState('')
  const [gTitle, setGTitle] = useState('')
  const [gType, setGType] = useState<'illust' | 'bg' | 'etc'>('illust')
  const [gNote, setGNote] = useState('')
  const [gImageUrl, setGImageUrl] = useState('')
  const [gOrder, setGOrder] = useState(0)
  const [gUploading, setGUploading] = useState(false)
  const gFileRef = useRef<HTMLInputElement>(null)
  const gTitleRef = useRef<HTMLInputElement>(null)

  const [showDelModal, setShowDelModal] = useState(false)
  const [deletingType, setDeletingType] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState('')

  // Cover upload state — which slot is currently uploading.
  const [coverUploadingKey, setCoverUploadingKey] = useState<CoverKey | null>(null)
  const coverFileRefs = {
    app: useRef<HTMLInputElement>(null),
    front: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
  } as const

  const [filterRoundQuarter, setFilterRoundQuarter] = useState('')
  const [filterPoemQuarter, setFilterPoemQuarter] = useState('')
  const [filterPoemRound, setFilterPoemRound] = useState('')

  const pwInputRef = useRef<HTMLInputElement>(null)
  const qTitleRef = useRef<HTMLInputElement>(null)
  const rTitleRef = useRef<HTMLInputElement>(null)
  const pPoetRef = useRef<HTMLInputElement>(null)

  // Detect orientation for mode
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(orientation: landscape)')
    const apply = (matches: boolean) => setMode(matches ? 'spread' : 'single')
    apply(mql.matches)
    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Detect wide viewport (PC / tablet landscape) for denser pagination
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 900px)')
    const apply = (matches: boolean) => setIsWide(matches)
    apply(mql.matches)
    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // PE-4: sync PC sidebar default to isWide once the viewport is known.
  // SSR-safe because sidebarOpen starts false; this only flips it open on PC.
  useEffect(() => {
    setSidebarOpen(isWide)
  }, [isWide])

  // Build pages per mode
  const pages: PageItem[] = useMemo(() => {
    if (!quarters.length) return []
    const data = { quarters, rounds, poems, freePoems }
    if (mode === 'spread') {
      // Wide viewport (PC, tablet landscape): denser pagination so each
      // spread page actually fills with content. Phone landscape stays sparse.
      return buildBookPages(
        data,
        isWide ? { maxFirst: 15, maxCont: 15, chars: 44 }
               : { maxFirst: 4, maxCont: 6, chars: 20 },
      )
    }
    return buildBookPages(
      data,
      isWide ? { maxFirst: 15, maxCont: 15, chars: 34 }
             : { maxFirst: 14, maxCont: 20, chars: 22 },
    )
  }, [quarters, rounds, poems, freePoems, mode, isWide])

  const tocTitleIdx = useMemo(() => {
    const i = pages.findIndex(p => p.type === 'toc-title')
    return i >= 0 ? i : 0
  }, [pages])

  // Restore last reading idx — V2 with one-shot migration from legacy keys.
  // PE-1: race-guarded. We MUST wait until Firestore pages are loaded (and
  // include at least one poem page) before reading legacy keys, otherwise the
  // sample-only fallback could prematurely consume + delete the legacy entry.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (pages.length === 0) return
    if (!pages.some(p => p.type === 'poem' || p.type === 'free-poem')) return

    const newKey = mode === 'spread' ? READ_IDX_KEY_SPREAD : READ_IDX_KEY_SINGLE
    const oldKey = mode === 'spread' ? OLD_READ_IDX_KEY_SPREAD : OLD_READ_IDX_KEY_SINGLE

    try {
      // Try V2 key first
      const v2raw = window.localStorage.getItem(newKey)
      if (v2raw != null) {
        const n = Number(v2raw)
        if (Number.isFinite(n) && n >= 0 && n < pages.length) setBookIdx(n)
        return
      }

      // V2 missing → migrate from legacy if present
      const oldraw = window.localStorage.getItem(oldKey)
      if (oldraw == null) return
      const oldN = Number(oldraw)
      if (!Number.isFinite(oldN)) return

      // Best-effort: clamp into bounds and snap to nearest poem/free-poem.
      // With chunks removed, the legacy idx no longer maps 1:1 — snapping to
      // the nearest readable page is acceptable for this one-shot migration.
      const clamped = Math.max(0, Math.min(pages.length - 1, oldN))
      let nearest = -1
      let bestDist = Infinity
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].type !== 'poem' && pages[i].type !== 'free-poem') continue
        const d = Math.abs(i - clamped)
        if (d < bestDist) { bestDist = d; nearest = i }
      }
      if (nearest >= 0) {
        setBookIdx(nearest)
        window.localStorage.setItem(newKey, String(nearest))
        window.localStorage.removeItem(oldKey)
      }
    } catch { /* noop */ }
  }, [mode, pages])

  const findPoemPageIdx = useCallback((poemId: string, isFree: boolean) => {
    return pages.findIndex(p => {
      if (isFree) return p.type === 'free-poem' && p.freePoem?.id === poemId
      return p.type === 'poem' && p.poem?.id === poemId
    })
  }, [pages])

  // Load data
  const loadAll = useCallback(async () => {
    try {
      const [qSnap, rSnap, pSnap, fSnap, gSnap] = await Promise.all([
        getDocs(query(collection(db, 'quarters'), orderBy('order'))),
        getDocs(query(collection(db, 'rounds'), orderBy('order'))),
        getDocs(query(collection(db, 'poems'), orderBy('order'))),
        getDocs(query(collection(db, 'freePoems'), orderBy('order'))),
        getDocs(query(collection(db, 'gallery'), orderBy('order'))),
      ])
      const qRaw = qSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const rRaw = rSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const pRaw = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const fRaw = fSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const gRaw = gSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const q = filterValid<Quarter>(qRaw, isQuarter)
      const r = filterValid<Round>(rRaw, isRound)
      const p = filterValid<Poem>(pRaw, isPoem)
      const f = filterValid<FreePoem>(fRaw, isFreePoem)
      const g = filterValid<GalleryItem>(gRaw, isGalleryItem)
      if (q.length || p.length) {
        setQuarters(q); setRounds(r); setPoems(p); setFreePoems(f)
        saveSnapshot(q, r, p, f)
      }
      setGalleryItems(g)
    } catch (e) { console.error('loadAll 실패:', e) }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadAll().then(() => {
      if (cancelled) return
      setQuarters(q => q.length ? q : SAMPLE.quarters)
      setRounds(r => r.length ? r : SAMPLE.rounds)
      setPoems(p => p.length ? p : SAMPLE.poems)
      setFreePoems(f => f.length ? f : SAMPLE.freePoems)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [loadAll])

  // Track bookIdx (last read position) — persist to localStorage
  const handleIdxChange = useCallback((newIdx: number) => {
    setBookIdx(newIdx)
    try {
      const key = mode === 'spread' ? READ_IDX_KEY_SPREAD : READ_IDX_KEY_SINGLE
      localStorage.setItem(key, String(newIdx))
    } catch { /* noop */ }
  }, [mode])

  const jumpToToc = useCallback(() => {
    setForcedIdx(tocTitleIdx)
    setForceJumpToken(t => t + 1)
    setCurrentView('book')
  }, [tocTitleIdx])

  const jumpToReading = useCallback(() => {
    setForcedIdx(bookIdx)
    setForceJumpToken(t => t + 1)
    setCurrentView('book')
  }, [bookIdx])

  const onSelectPoem = useCallback((poemId: string, isFree: boolean) => {
    const idx = findPoemPageIdx(poemId, isFree)
    if (idx < 0) return
    setForcedIdx(idx)
    setForceJumpToken(t => t + 1)
    setCurrentView('book')
  }, [findPoemPageIdx])

  // Jump to an arbitrary page index in the book (used by TocSidebar for
  // round-divider taps). Routes through the existing force-jump mechanism so
  // Book.tsx flushes the queued idx on the next idle phase.
  const jumpToBookIdx = useCallback((idx: number) => {
    if (idx < 0) return
    setForcedIdx(idx)
    setForceJumpToken(t => t + 1)
    setCurrentView('book')
  }, [])

  // Currently displayed poem id (for sidebar "is-current" highlight).
  const currentPoemId = useMemo(() => {
    const p = pages[bookIdx]
    if (!p) return null
    return p.poem?.id ?? p.freePoem?.id ?? null
  }, [pages, bookIdx])

  const bookData: BookSourceData = useMemo(() => ({
    quarters, rounds, poems, freePoems, onSelectPoem,
  }), [quarters, rounds, poems, freePoems, onSelectPoem])

  // View management
  const showView = (name: View) => {
    setCurrentView(name)
    if (name !== 'book') window.scrollTo({ top: 0 })
  }

  const tryEditMode = async () => {
    if (editMode) {
      try { await signOut(auth) } catch (e) { console.error(e) }
      setEditMode(false); showView('cover'); return
    }
    setPwInput(''); setPwError(false); setShowPwModal(true)
    setTimeout(() => pwInputRef.current?.focus(), 100)
  }

  const checkPassword = async () => {
    if (!ADMIN_EMAIL) {
      console.error('NEXT_PUBLIC_ADMIN_EMAIL env가 설정되지 않았습니다.')
      setPwError(true); return
    }
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pwInput)
      setShowPwModal(false); setEditMode(true); showView('edit')
    } catch (e) {
      console.error(e)
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
    } catch (e) { console.error('saveQuarter 실패:', e); alert('저장 실패: ' + (e instanceof Error ? (e.message + ' [' + ((e as { code?: string }).code ?? '') + ']') : String(e))) }
  }

  // Round CRUD
  const openRoundModal = (id?: string) => {
    if (!quarters.length) { alert('분기를 먼저 만들어주세요.'); return }
    setEditingRoundId(id || null)
    if (id) {
      const r = rounds.find(x => x.id === id)!
      setRQuarterId(r.quarterId); setRNum(r.num); setRTitle(r.title); setROrder(r.order)
    } else {
      setRQuarterId(quarters[0].id); setRNum(rounds.length + 1); setRTitle(''); setROrder(rounds.length)
    }
    setShowRoundModal(true)
    setTimeout(() => rTitleRef.current?.focus(), 100)
  }

  const saveRound = async () => {
    if (!rTitle.trim()) { alert('회차 시제를 입력해주세요.'); return }
    const data = { quarterId: rQuarterId, num: rNum, title: rTitle.trim(), order: rOrder }
    try {
      if (editingRoundId) {
        await updateDoc(doc(db, 'rounds', editingRoundId), data)
      } else {
        await addDoc(collection(db, 'rounds'), data)
      }
      setShowRoundModal(false); await loadAll()
    } catch (e) { console.error('saveRound 실패:', e); alert('저장 실패: ' + (e instanceof Error ? (e.message + ' [' + ((e as { code?: string }).code ?? '') + ']') : String(e))) }
  }

  // Poem CRUD
  const openPoemModal = (id?: string) => {
    if (!rounds.length) { alert('회차를 먼저 만들어주세요.'); return }
    setEditingPoemId(id || null); setEditingFreePoemId(null)
    setPType('round')
    if (id) {
      const p = poems.find(x => x.id === id)!
      setPRoundId(p.roundId); setPPoet(p.poet); setPTitle(p.title); setPBody(p.body); setPOrder(p.order)
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
      setPQuarterId(f.quarterId); setPPoet(f.poet); setPTitle(f.title); setPBody(f.body); setPOrder(f.order)
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
        const data = { quarterId: pQuarterId, poet: pPoet.trim(), title: pTitle.trim(), body: pBody, order: pOrder }
        if (editingFreePoemId) await updateDoc(doc(db, 'freePoems', editingFreePoemId), data)
        else await addDoc(collection(db, 'freePoems'), data)
      } else {
        const data = { roundId: pRoundId, poet: pPoet.trim(), title: pTitle.trim(), body: pBody, order: pOrder }
        if (editingPoemId) await updateDoc(doc(db, 'poems', editingPoemId), data)
        else await addDoc(collection(db, 'poems'), data)
      }
      setShowPoemModal(false); await loadAll()
    } catch (e) { console.error('savePoem 실패:', e); alert('저장 실패: ' + (e instanceof Error ? (e.message + ' [' + ((e as { code?: string }).code ?? '') + ']') : String(e))) }
  }

  // Delete
  const openDelModal = (type: string, id: string, name: string) => {
    setDeletingType(type); setDeletingId(id); setDeletingName(name); setShowDelModal(true)
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    const tbl = deletingType === 'quarter' ? 'quarters' : deletingType === 'round' ? 'rounds' : deletingType === 'freePoem' ? 'freePoems' : deletingType === 'gallery' ? 'gallery' : 'poems'
    try {
      await deleteDoc(doc(db, tbl, deletingId))
      setShowDelModal(false); setDeletingType(null); setDeletingId(null)
      await loadAll()
    } catch (e) { console.error('confirmDelete 실패:', e); alert('삭제 실패: ' + (e instanceof Error ? (e.message + ' [' + ((e as { code?: string }).code ?? '') + ']') : String(e))) }
  }

  // Gallery CRUD
  const openGalleryModal = (id?: string) => {
    if (!quarters.length) { alert('분기를 먼저 만들어주세요.'); return }
    setEditingGalleryId(id || null)
    if (id) {
      const g = galleryItems.find(x => x.id === id)!
      setGQuarterId(g.quarterId); setGTitle(g.title); setGType(g.type)
      setGNote(g.note || ''); setGImageUrl(g.imageUrl || ''); setGOrder(g.order)
    } else {
      setGQuarterId(quarters[0].id); setGTitle(''); setGType('illust')
      setGNote(''); setGImageUrl(''); setGOrder(galleryItems.length)
    }
    setGUploading(false)
    setShowGalleryModal(true)
    setTimeout(() => gTitleRef.current?.focus(), 100)
  }

  const saveGalleryItem = async () => {
    if (!gTitle.trim()) { alert('제목을 입력해주세요.'); return }
    let imageUrl = safeImageUrl(gImageUrl.trim())
    if (gImageUrl.trim() && !imageUrl) {
      alert('URL은 https:// 또는 data:image/... 형식만 허용돼요.')
      return
    }
    const file = gFileRef.current?.files?.[0]
    if (file) {
      const check = validateImageFile(file)
      if (!check.ok) { alert(check.reason); return }
      setGUploading(true)
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storageRef = ref(storage, `gallery/${Date.now()}_${safeName}`)
        const snap = await uploadBytes(storageRef, file, { contentType: file.type })
        imageUrl = await getDownloadURL(snap.ref)
      } catch (e) {
        console.error('이미지 업로드 실패:', e)
        alert('이미지 업로드 실패: ' + (e instanceof Error ? (e.message + ' [' + ((e as { code?: string }).code ?? '') + ']') : String(e)))
        setGUploading(false); return
      }
      setGUploading(false)
    }
    const data = { quarterId: gQuarterId, title: gTitle.trim(), type: gType, note: gNote.trim(), imageUrl, order: gOrder }
    try {
      if (editingGalleryId) await updateDoc(doc(db, 'gallery', editingGalleryId), data)
      else await addDoc(collection(db, 'gallery'), data)
      setShowGalleryModal(false); await loadAll()
    } catch (e) { console.error('saveGalleryItem 실패:', e); alert('저장 실패: ' + (e instanceof Error ? (e.message + ' [' + ((e as { code?: string }).code ?? '') + ']') : String(e))) }
  }

  // Cover upload handlers
  const handleCoverFile = async (key: CoverKey, file: File | undefined) => {
    if (!file) return
    const check = validateImageFile(file)
    if (!check.ok) { alert(check.reason); return }
    setCoverUploadingKey(key)
    try {
      await cover.uploadAndSet(key, file)
    } catch (e) {
      console.error('표지 업로드 실패:', e)
      alert('표지 업로드 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setCoverUploadingKey(null)
      const refEl = coverFileRefs[key].current
      if (refEl) refEl.value = ''
    }
  }
  const handleCoverClear = async (key: CoverKey) => {
    if (!confirm('이 표지 이미지를 지울까요?')) return
    try {
      await cover.setUrl(key, '')
    } catch (e) {
      alert('지우기 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // Rendered cover poets
  const coverPoets = [...new Set(poems.map(p => p.poet))].join(' · ')

  // Filter helpers for edit
  const filteredRounds = filterRoundQuarter ? rounds.filter(r => r.quarterId === filterRoundQuarter) : rounds
  const filteredPoems = (() => {
    let p = poems
    if (filterPoemQuarter) {
      const qRounds = rounds.filter(r => r.quarterId === filterPoemQuarter).map(r => r.id)
      p = p.filter(x => qRounds.includes(x.roundId))
    }
    if (filterPoemRound) p = p.filter(x => x.roundId === filterPoemRound)
    return p
  })()
  const filteredFreePoems = filterPoemQuarter ? freePoems.filter(f => f.quarterId === filterPoemQuarter) : freePoems

  if (loading) {
    return (
      <div id="loading" style={{ position: 'fixed', inset: 0, background: '#f8f8f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 300, color: '#555', letterSpacing: '0.15em', marginBottom: '1.5rem', fontFamily: "'Pretendard Variable', 'Noto Sans KR', sans-serif" }}>
          글빛을 모아 담다 시화 詩和
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#999', display: 'inline-block', animation: `bounce 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
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
        {/* PC-only: "차례" toggles the persistent sidebar. Mobile users have
            the bottom tabbar (목차) for the same purpose, so we hide this. */}
        {isWide && (
          <button
            className={`tb-btn${sidebarOpen ? ' active' : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
          >
            차례
          </button>
        )}
        <button className={`tb-btn${currentView === 'book' ? ' active' : ''}`} onClick={jumpToReading}>읽기</button>
        <button className={`tb-btn${currentView === 'gallery' ? ' active' : ''}`} onClick={() => showView('gallery')}>갤러리</button>
        <button className={`tb-btn${editMode ? ' active' : ''}`} onClick={tryEditMode}>편집</button>
      </div>

      <div id="main">
        {/* COVER */}
        {(() => {
          const appBg = safeImageUrl(cover.app)
          const coverStyle: React.CSSProperties = {
            display: currentView === 'cover' ? 'flex' : 'none',
            ...(appBg
              ? {
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.78)), url("${appBg}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {}),
          }
          return (
            <div id="cover" style={coverStyle}>
              <div className="cover-ornament">✦ ✦ ✦</div>
              <div className="cover-main-title">글빛을 모아 담다 시화 詩和</div>
              <div className="cover-poets">{coverPoets || '시인을 불러오는 중...'}</div>
              <div className="cover-year">2026</div>
              <button className="cover-start-btn" onClick={jumpToToc}>차례 보기</button>
            </div>
          )
        })()}

        {/* TOC SIDEBAR — PC persistent / Mobile fullscreen overlay */}
        {currentView === 'book' && (
          <TocSidebar
            quarters={quarters}
            rounds={rounds}
            poems={poems}
            freePoems={freePoems}
            open={isWide ? sidebarOpen : mobileTocOpen}
            onClose={() => isWide ? setSidebarOpen(false) : setMobileTocOpen(false)}
            viewportMode={isWide ? 'pc' : 'mobile'}
            currentPoemId={currentPoemId}
            onSelectPoem={(id, isFree) => { onSelectPoem(id, isFree) }}
            onSelectRound={(rid) => {
              const idx = pages.findIndex(p => p.type === 'round-divider' && p.round?.id === rid)
              if (idx >= 0) jumpToBookIdx(idx)
              if (!isWide) setMobileTocOpen(false)
            }}
          />
        )}

        {/* BOOK VIEWER (3D flip) */}
        <div
          id="book-viewer"
          className={`${currentView === 'book' ? 'active' : ''}${!isWide ? ' has-mobile-tabbar' : ''}`}
        >
          {pages.length > 0 && (
            <Book
              key={mode}
              pages={pages}
              mode={mode}
              data={bookData}
              initialIdx={bookIdx || (mode === 'spread' ? 0 : 1)}
              forcedIdx={forcedIdx}
              forceJumpToken={forceJumpToken}
              onIdxChange={handleIdxChange}
            />
          )}
          {currentView === 'book' && pages.length > 0 && (
            <OnboardingPopup variant={isWide ? 'landscape' : 'portrait'} />
          )}
        </div>

        {/* MOBILE BOTTOM TABBAR — only on mobile + book view */}
        {!isWide && currentView === 'book' && (
          <nav className="mobile-tabbar" aria-label="Mobile navigation">
            <button
              className="mobile-tabbar-btn"
              onClick={() => setMobileTocOpen(true)}
              aria-label="목차 열기"
            >
              <span>목차</span>
            </button>
          </nav>
        )}

        {/* GALLERY VIEW */}
        <div id="gallery-view" className={currentView === 'gallery' ? 'active' : ''}>
          {!galleryItems.length ? (
            <div className="empty-state">
              아직 등록된 이미지가 없어요.
            </div>
          ) : (
            quarters.sort((a, b) => a.order - b.order).map((q, qi) => {
              const gItems = galleryItems.filter(g => g.quarterId === q.id).sort((a, b) => a.order - b.order)
              if (!gItems.length) return null
              return (
                <div key={q.id} className="gallery-quarter">
                  <div className="gallery-quarter-label">{qi + 1}분기 — {q.title}</div>
                  <div className="gallery-grid">
                    {gItems.map(g => (
                      <div
                        key={g.id}
                        className="gallery-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => setLightboxItem(g)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setLightboxItem(g)
                          }
                        }}
                      >
                        {(() => {
                          const url = safeImageUrl(g.imageUrl)
                          return url
                            ? <div className="gallery-card-img">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} loading="lazy" alt={g.title} />
                            </div>
                            : <div className="gallery-card-img-placeholder">이미지 없음</div>
                        })()}
                        <div className="gallery-card-body">
                          <span className={`gallery-type-badge ${{ illust: 'badge-illust', bg: 'badge-bg', etc: 'badge-etc' }[g.type] || 'badge-etc'}`}>
                            {{ illust: '시 삽화', bg: '배경 삽화', etc: '기타' }[g.type] || '기타'}
                          </span>
                          <div className="gallery-card-title">{g.title}</div>
                          {g.note && <div className="gallery-card-note">{g.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* GALLERY LIGHTBOX */}
        {lightboxItem && (
          <div id="gallery-lightbox" className="active" onClick={() => setLightboxItem(null)}>
            <button id="lb-close" onClick={() => setLightboxItem(null)}>✕</button>
            {(() => {
              const url = safeImageUrl(lightboxItem.imageUrl)
              // eslint-disable-next-line @next/next/no-img-element
              return url ? <img id="lb-img" src={url} alt={lightboxItem.title} /> : null
            })()}
            <div id="lb-title">{lightboxItem.title}</div>
            <div id="lb-tag">{{ illust: '시 삽화', bg: '배경 삽화', etc: '기타' }[lightboxItem.type] || '기타'}</div>
            {lightboxItem.note && <div id="lb-note">{lightboxItem.note}</div>}
          </div>
        )}

        {/* EDIT PANEL */}
        <div id="edit-panel" className={currentView === 'edit' ? 'active' : ''}>
          <div className="firebase-notice">
            <strong>Firebase 연결</strong> — <code>.env.local</code>에 Firebase 설정값과 <code>NEXT_PUBLIC_ADMIN_EMAIL</code>을 입력하세요.
            컬렉션: <code>quarters</code> · <code>rounds</code> · <code>poems</code> · <code>freePoems</code> · <code>gallery</code>
          </div>
          <div className="edit-tabs">
            {(['quarters', 'rounds', 'poems', 'free', 'gallery', 'covers'] as TabName[]).map(t => (
              <button key={t} className={`edit-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
                {{ quarters: '분기', rounds: '회차', poems: '시', free: '자유시', gallery: '갤러리', covers: '표지' }[t]}
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
                const q = quarters.find(x => x.id === r.quarterId)
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
                  {(filterPoemQuarter ? rounds.filter(r => r.quarterId === filterPoemQuarter) : rounds)
                    .map(r => <option key={r.id} value={r.id}>{r.num}회차 — {r.title}</option>)}
                </select>
              </div>
              {filteredPoems.sort((a, b) => a.order - b.order).map(p => {
                const r = rounds.find(x => x.id === p.roundId)
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
                const q = quarters.find(x => x.id === f.quarterId)
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

          {/* 갤러리 탭 */}
          {activeTab === 'gallery' && (
            <div>
              <div className="edit-section-header">
                <div className="edit-section-title">갤러리 관리</div>
                <button className="edit-add-btn" onClick={() => openGalleryModal()}>+ 이미지 추가</button>
              </div>
              {galleryItems.sort((a, b) => a.order - b.order).map(g => {
                const q = quarters.find(x => x.id === g.quarterId)
                const typeLabel = { illust: '시 삽화', bg: '배경 삽화', etc: '기타' }[g.type] || '기타'
                return (
                  <div key={g.id} className="edit-card">
                    <div className="edit-card-info">
                      <div className="edit-card-title">{g.title}</div>
                      <div className="edit-card-sub">{typeLabel} · {q?.title || ''}</div>
                      {g.note && <div className="edit-card-preview">{g.note.slice(0, 60)}</div>}
                    </div>
                    <div className="edit-card-actions">
                      <button className="ecard-btn" onClick={() => openGalleryModal(g.id)}>수정</button>
                      <button className="ecard-btn del" onClick={() => openDelModal('gallery', g.id, g.title)}>삭제</button>
                    </div>
                  </div>
                )
              })}
              {!galleryItems.length && <div className="empty-state">갤러리에 이미지가 없어요.</div>}
            </div>
          )}

          {/* 표지 탭 */}
          {activeTab === 'covers' && (
            <div>
              <div className="edit-section-header">
                <div className="edit-section-title">표지 이미지</div>
              </div>
              <div className="cover-edit-grid">
                {([
                  { key: 'app' as CoverKey, label: '앱 홈 배경', desc: '홈 화면(표지) 뒤 배경 이미지' },
                  { key: 'front' as CoverKey, label: '앞표지', desc: '책의 첫 페이지' },
                  { key: 'back' as CoverKey, label: '뒷표지', desc: '책의 마지막 페이지' },
                ]).map(slot => {
                  const url = safeImageUrl((cover as unknown as Record<string, string>)[slot.key])
                  const uploading = coverUploadingKey === slot.key
                  return (
                    <div key={slot.key} className="cover-edit-slot">
                      <div className="cover-edit-label">
                        <strong>{slot.label}</strong>
                        <span className="cover-edit-desc">{slot.desc}</span>
                      </div>
                      <div className="cover-edit-preview">
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={slot.label} />
                        ) : (
                          <div className="cover-edit-empty">이미지 없음</div>
                        )}
                      </div>
                      <div className="cover-edit-actions">
                        <input
                          ref={coverFileRefs[slot.key]}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={uploading}
                          onChange={e => handleCoverFile(slot.key, e.target.files?.[0])}
                        />
                        {url && (
                          <button
                            className="ecard-btn del"
                            disabled={uploading}
                            onClick={() => handleCoverClear(slot.key)}
                          >
                            지우기
                          </button>
                        )}
                        {uploading && <span className="cover-edit-uploading">업로드 중...</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="empty-state" style={{ marginTop: 16, fontSize: 11 }}>
                PNG · JPEG · WebP · GIF · 최대 5MB. 업로드 시 Firebase Storage에 저장됩니다.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PASSWORD MODAL */}
      {showPwModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowPwModal(false)}>
          <div className="modal-box">
            <div className="modal-title">편집 모드</div>
            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input ref={pwInputRef} type="password" className="form-input" placeholder="••••••••"
                value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(false) }}
                onKeyDown={e => e.key === 'Enter' && checkPassword()} />
              {pwError && <div className="pw-error show">비밀번호가 맞지 않아요</div>}
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowPwModal(false)}>취소</button>
              <button className="modal-btn confirm" onClick={checkPassword}>확인</button>
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
                    const qr = rounds.filter(r => r.quarterId === q.id)
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

      {/* GALLERY MODAL */}
      {showGalleryModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowGalleryModal(false)}>
          <div className="modal-box">
            <div className="modal-title">{editingGalleryId ? '이미지 수정' : '이미지 추가'}</div>
            <div className="form-group">
              <label className="form-label">소속 분기</label>
              <select className="form-select" value={gQuarterId} onChange={e => setGQuarterId(e.target.value)}>
                {quarters.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">제목</label>
              <input ref={gTitleRef} type="text" className="form-input" placeholder="이미지 제목" value={gTitle} onChange={e => setGTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">용도</label>
              <select className="form-select" value={gType} onChange={e => setGType(e.target.value as 'illust' | 'bg' | 'etc')}>
                <option value="illust">시 삽화</option>
                <option value="bg">배경 삽화</option>
                <option value="etc">기타</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">주석 / 설명</label>
              <textarea className="form-textarea" placeholder="이미지에 대한 설명이나 주석..." style={{ minHeight: 80 }} value={gNote} onChange={e => setGNote(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">이미지 파일 업로드</label>
              <input ref={gFileRef} type="file" className="form-input" accept="image/*" style={{ padding: 6 }} />
              {gUploading && <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>업로드 중...</div>}
            </div>
            <div className="form-group">
              <label className="form-label">또는 이미지 URL 직접 입력</label>
              <input type="text" className="form-input" placeholder="https://..." value={gImageUrl} onChange={e => setGImageUrl(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">정렬 순서</label>
              <input type="number" className="form-input" value={gOrder} onChange={e => setGOrder(Number(e.target.value))} />
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowGalleryModal(false)}>취소</button>
              <button className="modal-btn confirm" onClick={saveGalleryItem} disabled={gUploading}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowDelModal(false)}>
          <div className="modal-box">
            <div className="modal-title">삭제 확인</div>
            <p style={{ fontFamily: "'Pretendard Variable', 'Noto Sans KR', sans-serif", fontSize: '13px', color: '#555', lineHeight: 1.7, marginBottom: '14px' }}>
              <strong style={{ color: '#111' }}>{deletingName}</strong>을(를) 삭제할까요? 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowDelModal(false)}>취소</button>
              <button className="modal-btn" style={{ background: '#c06060', border: 'none', color: '#fff' }} onClick={confirmDelete}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SihwaApp() {
  return (
    <CoverProvider>
      <SihwaAppInner />
    </CoverProvider>
  )
}

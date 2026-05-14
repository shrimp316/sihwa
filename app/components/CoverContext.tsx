'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { db, storage } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { safeImageUrl, validateImageFile } from '@/lib/validation'

export type CoverKey = 'app' | 'front' | 'back'

interface CoverContextValue {
  app: string
  front: string
  back: string
  /** Persist a raw URL (already validated by caller). */
  setUrl: (key: CoverKey, url: string) => Promise<void>
  /** Upload a file to Storage and persist its download URL. */
  uploadAndSet: (key: CoverKey, file: File) => Promise<string>
  loading: boolean
}

const defaults: CoverContextValue = {
  app: '',
  front: '',
  back: '',
  setUrl: async () => {},
  uploadAndSet: async () => '',
  loading: false,
}

const CoverContext = createContext<CoverContextValue>(defaults)

const LS_KEYS: Record<CoverKey, string> = {
  app: 'sihwa_cover_app',
  front: 'sihwa_cover_front',
  back: 'sihwa_cover_back',
}
const COVER_DOC_PATH = 'covers/main'

function readStored(key: string): string {
  if (typeof window === 'undefined') return ''
  try {
    return safeImageUrl(localStorage.getItem(key))
  } catch {
    return ''
  }
}
function writeStored(key: string, url: string) {
  if (typeof window === 'undefined') return
  try {
    if (url) localStorage.setItem(key, url)
    else localStorage.removeItem(key)
  } catch {
    /* noop */
  }
}

export function CoverProvider({ children }: { children: ReactNode }) {
  // Lazy init from localStorage snapshot for instant first paint.
  const [app, setApp] = useState(() => readStored(LS_KEYS.app))
  const [front, setFront] = useState(() => readStored(LS_KEYS.front))
  const [back, setBack] = useState(() => readStored(LS_KEYS.back))
  const [loading, setLoading] = useState(true)
  const loadedOnce = useRef(false)

  // Pull canonical URLs from Firestore (covers/main). Failures fall back to
  // the localStorage snapshot already in state.
  useEffect(() => {
    if (loadedOnce.current) return
    loadedOnce.current = true
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, COVER_DOC_PATH))
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>
          const a = safeImageUrl(data.app as string | undefined)
          const f = safeImageUrl(data.front as string | undefined)
          const b = safeImageUrl(data.back as string | undefined)
          setApp(a)
          setFront(f)
          setBack(b)
          writeStored(LS_KEYS.app, a)
          writeStored(LS_KEYS.front, f)
          writeStored(LS_KEYS.back, b)
        }
      } catch (e) {
        console.warn('CoverContext: Firestore load failed, using localStorage snapshot.', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const setUrl = useCallback(async (key: CoverKey, url: string) => {
    const safe = safeImageUrl(url)
    // Persist to Firestore canonical doc + localStorage snapshot.
    try {
      await setDoc(
        doc(db, COVER_DOC_PATH),
        { [key]: safe },
        { merge: true },
      )
    } catch (e) {
      console.error('CoverContext: Firestore write failed.', e)
      throw e
    }
    writeStored(LS_KEYS[key], safe)
    if (key === 'app') setApp(safe)
    else if (key === 'front') setFront(safe)
    else if (key === 'back') setBack(safe)
  }, [])

  const uploadAndSet = useCallback(async (key: CoverKey, file: File) => {
    const check = validateImageFile(file)
    if (!check.ok) throw new Error(check.reason)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `covers/${key}_${Date.now()}.${ext || 'jpg'}`
    const ref = storageRef(storage, path)
    const snap = await uploadBytes(ref, file, { contentType: file.type })
    const url = await getDownloadURL(snap.ref)
    await setUrl(key, url)
    return url
  }, [setUrl])

  return (
    <CoverContext.Provider value={{ app, front, back, setUrl, uploadAndSet, loading }}>
      {children}
    </CoverContext.Provider>
  )
}

export function useCoverContext(): CoverContextValue {
  return useContext(CoverContext)
}

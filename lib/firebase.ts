import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const db = getFirestore(app)

export type Quarter = {
  id: string
  title: string
  intro?: string
  order: number
}

export type Round = {
  id: string
  quarter_id: string
  num: number
  title: string
  order: number
}

export type Poem = {
  id: string
  round_id: string
  poet: string
  title: string
  body: string
  order: number
}

export type FreePoem = {
  id: string
  quarter_id: string
  poet: string
  title: string
  body: string
  order: number
}

export type GalleryItem = {
  id: string
  quarterId: string
  type: 'illust' | 'bg' | 'etc'
  title: string
  imageUrl?: string
  note?: string
  order: number
}

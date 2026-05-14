import type { Quarter, Round, Poem, FreePoem, GalleryItem } from './firebase'

// Image URL scheme allowlist: https://, root-relative /, data:image/(png|jpeg|webp|gif|svg+xml).
// Reject javascript:, data:text/html, ftp:, etc. Strip whitespace before checking.
const SAFE_IMAGE_URL = /^(https:\/\/|\/(?!\/)|data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,)/i

export function safeImageUrl(u: string | undefined | null): string {
  if (!u) return ''
  const trimmed = String(u).trim()
  if (!trimmed) return ''
  if (!SAFE_IMAGE_URL.test(trimmed)) return ''
  return trimmed
}

// Upload validation: size + MIME allowlist.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export function validateImageFile(file: File): { ok: true } | { ok: false; reason: string } {
  if (!file) return { ok: false, reason: '파일이 비어 있어요.' }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: `파일이 너무 커요 (최대 ${MAX_IMAGE_BYTES / 1024 / 1024}MB)` }
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return { ok: false, reason: '지원하지 않는 형식이에요. (PNG, JPEG, WebP, GIF만 허용)' }
  }
  return { ok: true }
}

// Firestore doc type guards — defensive at the boundary.
type RawDoc = Record<string, unknown>

function isString(v: unknown): v is string {
  return typeof v === 'string'
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v)
}

export function isQuarter(d: RawDoc): d is RawDoc & Quarter {
  return isString(d.id) && isString(d.title) && isNumber(d.order)
}

export function isRound(d: RawDoc): d is RawDoc & Round {
  return (
    isString(d.id) &&
    isString(d.quarterId) &&
    isNumber(d.num) &&
    isString(d.title) &&
    isNumber(d.order)
  )
}

export function isPoem(d: RawDoc): d is RawDoc & Poem {
  return (
    isString(d.id) &&
    isString(d.roundId) &&
    isString(d.poet) &&
    isString(d.title) &&
    isString(d.body) &&
    isNumber(d.order)
  )
}

export function isFreePoem(d: RawDoc): d is RawDoc & FreePoem {
  return (
    isString(d.id) &&
    isString(d.quarterId) &&
    isString(d.poet) &&
    isString(d.title) &&
    isString(d.body) &&
    isNumber(d.order)
  )
}

export function isGalleryItem(d: RawDoc): d is RawDoc & GalleryItem {
  return (
    isString(d.id) &&
    isString(d.quarterId) &&
    isString(d.title) &&
    (d.type === 'illust' || d.type === 'bg' || d.type === 'etc') &&
    isNumber(d.order)
  )
}

export function filterValid<T>(docs: RawDoc[], guard: (d: RawDoc) => d is RawDoc & T): T[] {
  const out: T[] = []
  for (const d of docs) {
    if (guard(d)) out.push(d as RawDoc & T)
    else console.warn('Skipping malformed Firestore doc:', d)
  }
  return out
}

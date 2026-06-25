// Offline-resilient queue for Stay Journal entries, backed by IndexedDB so
// photo blobs survive a page reload. Entries added while offline (or when an
// upload fails) are flushed automatically when connectivity returns.
import { supabase } from '@/lib/supabase'

const DB_NAME = 'pawboard'
const STORE   = 'journal_queue'
const VERSION = 1

export type QueuedEntry = {
  id:          string
  bookingId:   string
  businessId:  string
  entryType:   string
  body:        string | null
  authorLabel: string | null
  blob:        Blob | null
  fileName:    string
  fileType:    string
  createdAt:   number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function runTx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror   = () => reject(req.error)
  }))
}

export async function enqueue(entry: Omit<QueuedEntry, 'id' | 'createdAt'>): Promise<QueuedEntry> {
  const item: QueuedEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() }
  await runTx('readwrite', s => s.add(item))
  return item
}

async function getAll(): Promise<QueuedEntry[]> {
  const all = await runTx<QueuedEntry[]>('readonly', s => s.getAll())
  return (all ?? []).sort((a, b) => a.createdAt - b.createdAt)
}

export async function listQueued(bookingId: string): Promise<QueuedEntry[]> {
  return (await getAll()).filter(i => i.bookingId === bookingId)
}

export async function countQueued(): Promise<number> {
  return (await getAll()).length
}

export async function removeQueued(id: string): Promise<void> {
  await runTx('readwrite', s => s.delete(id))
}

async function uploadOne(item: QueuedEntry): Promise<boolean> {
  try {
    let photoUrl: string | null = null
    if (item.blob) {
      const safe = (item.fileName || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `journal/${item.bookingId}/${item.createdAt}-${safe}`
      const up = await supabase.storage.from('pets').upload(path, item.blob, {
        contentType: item.fileType || 'image/jpeg', upsert: false,
      })
      if (up.error) throw up.error
      photoUrl = supabase.storage.from('pets').getPublicUrl(path).data.publicUrl
    }
    const ins = await supabase.from('stay_journal_entries').insert({
      business_id:  item.businessId,
      booking_id:   item.bookingId,
      entry_type:   item.entryType,
      body:         item.body,
      photo_url:    photoUrl,
      author_label: item.authorLabel,
    })
    if (ins.error) throw ins.error
    await removeQueued(item.id)
    return true
  } catch {
    return false
  }
}

/** Add a journal entry — uploads directly when online, otherwise queues it. */
export async function submitJournalEntry(opts: {
  businessId: string
  bookingId: string
  authorLabel: string
  entryType: string
  body: string
  file: File | null
}): Promise<'saved' | 'queued'> {
  const { businessId, bookingId, authorLabel, entryType, file } = opts
  const body = opts.body.trim() || null

  if (file && navigator.onLine) {
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `journal/${bookingId}/${Date.now()}-${safe}`
      const up = await supabase.storage.from('pets').upload(path, file, { contentType: file.type, upsert: false })
      if (up.error) throw up.error
      const photoUrl = supabase.storage.from('pets').getPublicUrl(path).data.publicUrl
      const ins = await supabase.from('stay_journal_entries').insert({
        business_id: businessId, booking_id: bookingId, entry_type: entryType, body, photo_url: photoUrl, author_label: authorLabel,
      })
      if (ins.error) throw ins.error
      return 'saved'
    } catch {
      await enqueue({ bookingId, businessId, entryType, body, authorLabel, blob: file, fileName: file.name, fileType: file.type })
      return 'queued'
    }
  }
  if (file) {
    await enqueue({ bookingId, businessId, entryType, body, authorLabel, blob: file, fileName: file.name, fileType: file.type })
    return 'queued'
  }
  if (navigator.onLine) {
    const ins = await supabase.from('stay_journal_entries').insert({
      business_id: businessId, booking_id: bookingId, entry_type: entryType, body, author_label: authorLabel,
    })
    if (ins.error) throw new Error(ins.error.message)
    return 'saved'
  }
  await enqueue({ bookingId, businessId, entryType, body, authorLabel, blob: null, fileName: '', fileType: '' })
  return 'queued'
}

let flushing = false

/** Upload all queued entries. Stops at the first failure (likely offline again). */
export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let uploaded = 0
  try {
    for (const item of await getAll()) {
      if (await uploadOne(item)) uploaded++
      else break
    }
  } finally {
    flushing = false
  }
  return uploaded
}

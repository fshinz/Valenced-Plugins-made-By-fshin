export type DiagnosticEntry = {
  id: string
  title: string
  message: string
  stack?: string
  context?: string
  timestamp: number
  level: 'error' | 'warning' | 'info'
}

export type DoctorState = {
  entries: DiagnosticEntry[]
  enabled: boolean
}

type JsonStorage = {
  cache?: unknown
  loaded?: boolean
  get?: () => Promise<unknown>
  use: () => unknown
  set: (value: unknown, flush?: boolean) => Promise<unknown>
}

let storage: JsonStorage | undefined
let writeQueue: Promise<unknown> = Promise.resolve()

const MAX_ENTRIES = 100

export function bindStorage(next: JsonStorage) {
  storage = next
}

function isEntry(value: unknown): value is DiagnosticEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<DiagnosticEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.message === 'string' &&
    typeof entry.timestamp === 'number'
  )
}

function normalizeState(value: unknown): DoctorState {
  if (!value || typeof value !== 'object') return { entries: [], enabled: true }
  const raw = value as Partial<DoctorState>
  return {
    entries: Array.isArray(raw.entries)
      ? raw.entries.filter(isEntry).slice(0, MAX_ENTRIES)
      : [],
    enabled: raw.enabled !== false,
  }
}

export function readState(): DoctorState {
  return normalizeState(storage?.use?.())
}

function readCachedState(): DoctorState {
  return normalizeState(storage?.cache)
}

async function waitUntilLoaded() {
  if (!storage) return
  for (let waited = 0; storage.loaded === false && waited < 5000; waited += 25) {
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  if (storage.loaded === false) await storage.get?.()
}

export function saveState(next: DoctorState) {
  const job = writeQueue.then(async () => {
    if (!storage) return
    await waitUntilLoaded()
    const normalized = normalizeState(next)
    storage.cache = normalized
    await storage.set(normalized, true)
  })
  writeQueue = job.catch(() => {})
  return job
}

export async function recordError(error: unknown, context = 'DevLab') {
  const current = readCachedState()
  const actualError = error instanceof Error ? error : new Error(String(error))
  const entry: DiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: context,
    message: actualError.message,
    stack: actualError.stack,
    context,
    timestamp: Date.now(),
    level: 'error',
  }
  await saveState({
    ...current,
    entries: [entry, ...current.entries].slice(0, MAX_ENTRIES),
  })
}

export async function clearErrors() {
  const current = readCachedState()
  await saveState({ ...current, entries: [] })
}

export async function setMonitoringEnabled(enabled: boolean) {
  const current = readCachedState()
  await saveState({ ...current, enabled })
}w
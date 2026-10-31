export type WatchEntry = {
  storeName: string
  snapshot: string
  timestamp: number
}

type Listener = (entry: WatchEntry) => void

const listeners: Set<Listener> = new Set()
const subscriptions: Map<string, () => void> = new Map()

export function addWatchListener(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(storeName: string, snapshot: unknown) {
  const text = (() => {
    try { return JSON.stringify(snapshot, null, 2) } catch { return String(snapshot) }
  })()
  const entry: WatchEntry = { storeName, snapshot: text, timestamp: Date.now() }
  for (const fn of listeners) { try { fn(entry) } catch { /* */ } }
}

// Try every path we know about to get the Flux dispatcher / store registry.
function getFluxRegistry(): Record<string, any> | null {
  const g = globalThis as any
  const candidates = [
    g.__valenced?.stores,
    g.__valenced?.flux?._stores,
    g.__valenced?.flux?.stores,
    g.Flux?._stores,
    g.Flux?.stores,
    g.__flux?._stores,
  ]
  for (const c of candidates) {
    if (c && typeof c === 'object' && Object.keys(c).length > 0) return c
  }
  return null
}

export function getAllStoreNames(): string[] {
  const reg = getFluxRegistry()
  if (!reg) return []
  return Object.keys(reg).sort()
}

function getStore(name: string): any {
  const reg = getFluxRegistry()
  if (!reg) return null
  return reg[name] ?? null
}

export function watchStore(name: string): boolean {
  if (subscriptions.has(name)) return true
  const store = getStore(name)
  if (!store) return false

  const handler = () => {
    try { emit(name, store.getState?.() ?? '(no getState)') } catch (e) { emit(name, { error: String(e) }) }
  }

  store.addChangeListener?.(handler)
  subscriptions.set(name, () => store.removeChangeListener?.(handler))
  return true
}

export function unwatchStore(name: string) {
  subscriptions.get(name)?.()
  subscriptions.delete(name)
}

export function getWatchedStores(): string[] {
  return Array.from(subscriptions.keys())
}

export function clearAllWatches() {
  for (const fn of subscriptions.values()) { try { fn() } catch { /* */ } }
  subscriptions.clear()
}
// Live Watch — subscribes to Flux stores and emits state snapshots.

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
  const entry: WatchEntry = {
    storeName,
    snapshot: JSON.stringify(snapshot, null, 2),
    timestamp: Date.now(),
  }
  for (const fn of listeners) {
    try { fn(entry) } catch { /* */ }
  }
}

export function watchStore(storeName: string): boolean {
  if (subscriptions.has(storeName)) return false

  try {
    const g = globalThis as any
    const flux = g.__valenced?.flux ?? g.Flux
    if (!flux) return false

    const store = flux.getStore?.(storeName)
    if (!store) return false

    const handler = () => {
      try {
        const state = store.getState?.() ?? '(no getState)'
        emit(storeName, state)
      } catch (e) {
        emit(storeName, { error: String(e) })
      }
    }

    store.addChangeListener?.(handler)
    subscriptions.set(storeName, () => store.removeChangeListener?.(handler))
    return true
  } catch {
    return false
  }
}

export function unwatchStore(storeName: string) {
  const unsub = subscriptions.get(storeName)
  if (unsub) {
    unsub()
    subscriptions.delete(storeName)
  }
}

export function getWatchedStores(): string[] {
  return Array.from(subscriptions.keys())
}

export function clearAllWatches() {
  for (const unsub of subscriptions.values()) {
    try { unsub() } catch { /* */ }
  }
  subscriptions.clear()
}
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
  use: () => unknown
  set: (value: unknown, flush?: boolean) => Promise<unknown>
}

let storage: JsonStorage | undefined

const MAX_ENTRIES = 100

export function bindStorage(next: JsonStorage) {
  storage = next
}

export function readState(): DoctorState {
  const raw = storage?.use?.()

  if (!raw || typeof raw !== 'object') {
    return { entries: [], enabled: true }
  }

  const value = raw as Partial<DoctorState>

  return {
    entries: Array.isArray(value.entries) ? value.entries : [],
    enabled: value.enabled !== false,
  }
}

export async function saveState(next: DoctorState) {
  if (!storage) return

  await storage.set(
    {
      entries: next.entries.slice(0, MAX_ENTRIES),
      enabled: next.enabled,
    },
    true,
  )
}

export async function recordError(
  error: unknown,
  context = 'Plugin Doctor',
) {
  const state = readState()
  const value = error instanceof Error ? error : new Error(String(error))

  const entry: DiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: context,
    message: value.message,
    stack: value.stack,
    context,
    timestamp: Date.now(),
    level: 'error',
  }

  await saveState({
    ...state,
    entries: [entry, ...state.entries].slice(0, MAX_ENTRIES),
  })
}

export async function clearErrors() {
  const state = readState()
  await saveState({ ...state, entries: [] })
}

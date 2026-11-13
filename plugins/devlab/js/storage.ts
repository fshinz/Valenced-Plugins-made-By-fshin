import type { JsonStorage } from '@valenced/json-storage'

export type DiagnosticEntry = {
	id: string
	title: string
	message: string
	stack?: string
	timestamp: number
	level: 'error' | 'warning' | 'info'
}

export type DevLabState = {
	entries: DiagnosticEntry[]
	enabled: boolean
}

let storage: JsonStorage<DevLabState> | undefined
let writeQueue: Promise<unknown> = Promise.resolve()

const MAX_ENTRIES = 100

export function bindStorage(next: JsonStorage<DevLabState>) {
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

function normalizeState(value: unknown): DevLabState {
	if (!value || typeof value !== 'object') return { entries: [], enabled: true }
	const raw = value as Partial<DevLabState>
	return {
		entries: Array.isArray(raw.entries)
			? raw.entries.filter(isEntry).slice(0, MAX_ENTRIES)
			: [],
		enabled: raw.enabled !== false,
	}
}

export function readState(): DevLabState {
	return normalizeState(storage?.use())
}

async function waitUntilLoaded() {
	if (!storage) return
	for (
		let waited = 0;
		storage.loaded === false && waited < 5000;
		waited += 25
	) {
		await new Promise(resolve => setTimeout(resolve, 25))
	}
	if (storage.loaded === false) await storage.get?.()
}

// Runs inside the queue on the loaded state, so bursts of errors don't overwrite each other.
function updateState(update: (state: DevLabState) => DevLabState) {
	const job = writeQueue.then(async () => {
		if (!storage) return
		await waitUntilLoaded()
		const next = normalizeState(update(normalizeState(storage.cache)))
		storage.cache = next
		await storage.set(next, true)
	})
	writeQueue = job.catch(() => {})
	return job
}

export function recordError(error: unknown, title = 'DevLab') {
	const { message, stack } =
		error instanceof Error ? error : new Error(String(error))
	const entry: DiagnosticEntry = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		title,
		message,
		stack,
		timestamp: Date.now(),
		level: 'error',
	}
	return updateState(state => ({
		...state,
		entries: [entry, ...state.entries],
	})).catch(() => {})
}

export function clearErrors() {
	return updateState(state => ({ ...state, entries: [] }))
}

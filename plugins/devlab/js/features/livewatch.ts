type StoreMap = Record<string, any>;

export type WatchEntry = {
  id: string;
  storeName: string;
  timestamp: number;
  snapshot: string;
};

type WatchLogListener = (entry: WatchEntry) => void;

const watches = new Map<string, { interval: ReturnType<typeof setInterval>; lastSnapshot: string; removeChangeListener?: () => void }>();
const listeners = new Set<WatchLogListener>();
const eventLog: WatchEntry[] = [];
const MAX_LOG = 100;
const SENSITIVE_KEY = /(token|authorization|password|secret|cookie|session.?id|api.?key|credential)/i;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 40;
const MAX_OBJECT_KEYS = 80;
const WATCH_INTERVAL = 1000;

function getStores(): StoreMap {
  try {
	const stores = (globalThis as any).valenced?.discord?.flux?.Stores;
	return stores && typeof stores === 'object' ? stores : {};
  } catch {
	return {};
  }
}

export function getAllStoreNames(): string[] {
  return Object.keys(getStores()).sort((a, b) => a.localeCompare(b));
}

export function getStore(storeName: string): any {
  return getStores()[storeName];
}

function safeCall<T>(callback: () => T): T | undefined {
  try { return callback(); } catch { return undefined; }
}

function sanitize(value: any, depth = 0, seen = new WeakSet<object>()): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 4000 ? `${value.slice(0, 4000)}… [truncated]` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value !== 'object') return String(value);
  if (depth >= MAX_DEPTH) return '[Max depth reached]';
  if (seen.has(value)) return '[Circular reference]';
  seen.add(value);
  try {
	if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map(v => sanitize(v, depth + 1, seen));
	const result: Record<string, any> = {};
	const keys = safeCall(() => Object.keys(value)) ?? [];
	for (const key of keys.slice(0, MAX_OBJECT_KEYS)) {
	  if (SENSITIVE_KEY.test(key)) { result[key] = '[REDACTED]'; continue; }
	  result[key] = safeCall(() => sanitize(value[key], depth + 1, seen)) ?? '[Unable to read property]';
	}
	if (keys.length > MAX_OBJECT_KEYS) result['…'] = '[Additional properties omitted]';
	return result;
  } finally { seen.delete(value); }
}

export function snapshotStore(storeName: string): unknown {
  const store = getStore(storeName);
  if (!store) return { error: `Store "${storeName}" was not found.` };
  // Do not inspect authentication/session stores at all.
  if (SENSITIVE_KEY.test(storeName)) return { name: storeName, redacted: true, message: 'This store is hidden because its name suggests sensitive authentication data.' };

  const keys = safeCall(() => Object.keys(store)) ?? [];
  const properties: Record<string, any> = {};
  for (const key of keys.slice(0, MAX_OBJECT_KEYS)) {
	if (SENSITIVE_KEY.test(key)) { properties[key] = '[REDACTED]'; continue; }
	const value = safeCall(() => store[key]);
	properties[key] = typeof value === 'function' ? `[Function ${value.name || key}]` : sanitize(value);
  }
  if (keys.length > MAX_OBJECT_KEYS) properties['…'] = '[Additional properties omitted]';
  const getters: Record<string, unknown> = {};
  // Read a small allowlist of conventional getters so changes to store state
  // can be detected even when its backing fields are private/non-enumerable.
  for (const getterName of ['getCurrentUserId', 'getChannelId', 'getGuildId', 'getSelectedChannelId', 'getSelectedGuildId']) {
	if (typeof safeCall(() => store[getterName]) === 'function') {
	  getters[getterName] = sanitize(safeCall(() => store[getterName]()));
	}
  }
  return {
	name: storeName,
	type: typeof store,
	properties,
	methods: keys.filter(key => typeof safeCall(() => store[key]) === 'function'),
	getters,
  };
}

export function getStoreSnapshot(storeName: string): unknown { return snapshotStore(storeName); }

function serializeSnapshot(snapshot: unknown): string {
  try { return JSON.stringify(snapshot); } catch { return String(snapshot); }
}

function emit(storeName: string, snapshot: unknown) {
  const entry: WatchEntry = {
	id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	storeName,
	timestamp: Date.now(),
	snapshot: serializeSnapshot(snapshot),
  };
  eventLog.unshift(entry);
  if (eventLog.length > MAX_LOG) eventLog.length = MAX_LOG;
  for (const listener of [...listeners]) {
	try { listener(entry); } catch (error) { console.error('[DevLab] Watch listener failed:', error); }
  }
}

/** Subscribe to the shared log. Existing entries remain available when the screen unmounts. */
export function addWatchListener(listener: WatchLogListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getWatchLog(): WatchEntry[] { return eventLog.slice(); }

export function clearWatchLog(): void { eventLog.splice(0, eventLog.length); }

export function watchStore(storeName: string): boolean {
  const store = getStore(storeName);
  if (!store || watches.has(storeName)) return !!store;
  const initial = snapshotStore(storeName);
  const entry = { lastSnapshot: serializeSnapshot(initial), removeChangeListener: undefined as (() => void) | undefined, interval: setInterval(() => {
	const current = watches.get(storeName);
	if (!current) return;
	const snapshot = snapshotStore(storeName);
	const serialized = serializeSnapshot(snapshot);
	if (serialized === current.lastSnapshot) return;
	current.lastSnapshot = serialized;
	emit(storeName, snapshot);
  }, WATCH_INTERVAL) };
  watches.set(storeName, entry);
  // Flux stores usually expose change listeners; use them for immediate events
  // and retain polling as a fallback for stores without that API.
  try {
	if (typeof store.addChangeListener === 'function') {
	  const onChange = () => {
		const current = watches.get(storeName);
		if (!current) return;
		const snapshot = snapshotStore(storeName);
		const serialized = serializeSnapshot(snapshot);
		current.lastSnapshot = serialized;
		// The store itself has signalled a change, so log it even if the
		// visible snapshot does not expose the internal field that changed.
		emit(storeName, snapshot);
	  };
	  store.addChangeListener(onChange);
	  entry.removeChangeListener = () => {
		try { store.removeChangeListener?.(onChange); } catch { /* */ }
	  };
	}
  } catch { /* polling remains active */ }
  emit(storeName, { event: 'watch-started', storeName, snapshot: initial });
  return true;
}

export function unwatchStore(storeName: string): boolean {
  const entry = watches.get(storeName);
  if (!entry) return false;
  clearInterval(entry.interval);
  try { entry.removeChangeListener?.(); } catch { /* */ }
  watches.delete(storeName);
  emit(storeName, { event: 'watch-stopped', storeName });
  return true;
}

export function getWatchedStores(): string[] { return [...watches.keys()].sort((a, b) => a.localeCompare(b)); }

export function clearAllWatches(): void {
  for (const entry of watches.values()) { clearInterval(entry.interval); try { entry.removeChangeListener?.(); } catch { /* */ } }
  const names = [...watches.keys()];
  watches.clear();
  for (const name of names) emit(name, { event: 'watch-stopped', storeName: name });
}

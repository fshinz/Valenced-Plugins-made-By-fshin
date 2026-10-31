type StoreMap = Record<string, any>;
type WatchListener = (storeName: string, snapshot: unknown) => void;

type WatchEntry = {
	storeName: string;
	interval: ReturnType<typeof setInterval>;
	listeners: Set<WatchListener>;
	lastSnapshot: string;
};

const watches = new Map<string, WatchEntry>();
const globalListeners = new Set<WatchListener>();

const SENSITIVE_KEY =
	/(token|authorization|password|secret|cookie|session.?id|api.?key|credential)/i;

const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;
const WATCH_INTERVAL = 1000;

function getStores(): StoreMap {
	try {
		const root = (globalThis as any).valenced;
		const stores = root?.discord?.flux?.Stores;

		return stores && typeof stores === "object" ? stores : {};
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

function sanitize(
	value: any,
	depth = 0,
	seen = new WeakSet<object>(),
): any {
	if (value === null || value === undefined) {
		return value;
	}

	if (typeof value === "string") {
		return value.length > 10_000
			? `${value.slice(0, 10_000)}… [truncated]`
			: value;
	}

	if (
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value;
	}

	if (typeof value === "bigint") {
		return `${value.toString()}n`;
	}

	if (typeof value === "function") {
		return `[Function ${value.name || "anonymous"}]`;
	}

	if (typeof value !== "object") {
		return String(value);
	}

	if (depth >= MAX_DEPTH) {
		return "[Max depth reached]";
	}

	if (seen.has(value)) {
		return "[Circular reference]";
	}

	seen.add(value);

	try {
		if (Array.isArray(value)) {
			return value
				.slice(0, MAX_ARRAY_ITEMS)
				.map((item) => sanitize(item, depth + 1, seen));
		}

		const result: Record<string, any> = {};
		let keys: string[];

		try {
			keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
		} catch {
			return "[Unable to inspect object]";
		}

		for (const key of keys) {
			if (SENSITIVE_KEY.test(key)) {
				result[key] = "[REDACTED]";
				continue;
			}

			try {
				result[key] = sanitize(value[key], depth + 1, seen);
			} catch {
				result[key] = "[Unable to read property]";
			}
		}

		if (Object.keys(value).length > MAX_OBJECT_KEYS) {
			result["…"] = "[Additional properties omitted]";
		}

		return result;
	} finally {
		seen.delete(value);
	}
}

function safeCall<T>(callback: () => T): T | undefined {
	try {
		return callback();
	} catch {
		return undefined;
	}
}

export function snapshotStore(storeName: string): unknown {
	const store = getStore(storeName);

	if (!store) {
		return {
			error: `Store "${storeName}" was not found.`,
		};
	}

	const snapshot: Record<string, any> = {
		name: storeName,
		type: typeof store,
	};

	const ownProperties = safeCall(() => Object.keys(store)) ?? [];

	snapshot.properties = {};

	for (const key of ownProperties.slice(0, MAX_OBJECT_KEYS)) {
		if (SENSITIVE_KEY.test(key)) {
			snapshot.properties[key] = "[REDACTED]";
			continue;
		}

		const value = safeCall(() => store[key]);

		if (typeof value === "function") {
			snapshot.properties[key] = `[Function ${value.name || key}]`;
		} else {
			snapshot.properties[key] = sanitize(value);
		}
	}

	if (ownProperties.length > MAX_OBJECT_KEYS) {
		snapshot.properties["…"] = "[Additional properties omitted]";
	}

	const methods = ownProperties.filter(
		(key) => typeof safeCall(() => store[key]) === "function",
	);

	snapshot.methods = methods;

	/*
	 * Only call a small set of conventional, zero-argument getters.
	 * Never invoke arbitrary store methods automatically.
	 */
	const knownGetters = [
		"getCurrentUser",
		"getCurrentUserId",
		"getChannelId",
		"getGuildId",
		"getSelectedChannelId",
		"getSelectedGuildId",
		"getGuilds",
		"getChannels",
	];

	snapshot.getters = {};

	for (const getterName of knownGetters) {
		if (typeof safeCall(() => store[getterName]) !== "function") {
			continue;
		}

		const result = safeCall(() => store[getterName]());

		/*
		 * Avoid exposing authentication-related store contents.
		 * User and channel data are sanitized, but can still be personal.
		 */
		if (SENSITIVE_KEY.test(storeName)) {
			snapshot.getters[getterName] = "[REDACTED]";
		} else {
			snapshot.getters[getterName] = sanitize(result);
		}
	}

	return snapshot;
}

export function getStoreSnapshot(storeName: string): unknown {
	return snapshotStore(storeName);
}

function serializeSnapshot(snapshot: unknown): string {
	try {
		return JSON.stringify(snapshot);
	} catch {
		return String(snapshot);
	}
}

function notifyListeners(
	storeName: string,
	snapshot: unknown,
	listeners: Iterable<WatchListener>,
): void {
	for (const listener of listeners) {
		try {
			listener(storeName, snapshot);
		} catch (error) {
			console.error("[Plugin Doctor] Watch listener failed:", error);
		}
	}
}

/**
 * Register a listener for store-watch updates.
 * Returns an unsubscribe function.
 *
 * Callback signature: (storeName, snapshot) => void
 */
export function addWatchListener(
	listener: WatchListener,
): () => void {
	globalListeners.add(listener);

	return () => {
		globalListeners.delete(listener);

		for (const entry of watches.values()) {
			entry.listeners.delete(listener);
		}
	};
}

export function subscribeToStoreChanges(
	storeName: string,
	listener: WatchListener,
): () => void {
	const unsubscribeGlobal = addWatchListener(listener);

	const entry = watches.get(storeName);

	if (entry) {
		entry.listeners.add(listener);
	}

	return () => {
		unsubscribeGlobal();

		const currentEntry = watches.get(storeName);
		currentEntry?.listeners.delete(listener);
	};
}

export function watchStore(
	storeName: string,
	listener?: WatchListener,
): boolean {
	if (!getStore(storeName)) {
		return false;
	}

	let entry = watches.get(storeName);

	if (!entry) {
		const initialSnapshot = snapshotStore(storeName);

		entry = {
			storeName,
			interval: setInterval(() => {
				const current = watches.get(storeName);

				if (!current) {
					return;
				}

				const snapshot = snapshotStore(storeName);
				const serialized = serializeSnapshot(snapshot);

				if (serialized === current.lastSnapshot) {
					return;
				}

				current.lastSnapshot = serialized;

				notifyListeners(
					storeName,
					snapshot,
					[...globalListeners, ...current.listeners],
				);
			}, WATCH_INTERVAL),
			listeners: new Set<WatchListener>(),
			lastSnapshot: serializeSnapshot(initialSnapshot),
		};

		watches.set(storeName, entry);
	}

	if (listener) {
		entry.listeners.add(listener);
	}

	return true;
}

export function unwatchStore(storeName: string): boolean {
	const entry = watches.get(storeName);

	if (!entry) {
		return false;
	}

	clearInterval(entry.interval);
	watches.delete(storeName);

	return true;
}

export function getWatchedStores(): string[] {
	return [...watches.keys()].sort((a, b) => a.localeCompare(b));
}

export function clearAllWatches(): void {
	for (const entry of watches.values()) {
		clearInterval(entry.interval);
	}

	watches.clear();
	globalListeners.clear();
}
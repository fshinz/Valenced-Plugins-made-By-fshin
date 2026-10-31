import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'

const h = (...args: any[]) => React.createElement(...args)

const MAX_LOG = 100

export type WatchEntry = {
  storeName: string
  snapshot: string
  timestamp: number
}

// ── store discovery ────────────────────────────────────────────────────────────

function getFlux(): any {
  const g = globalThis as any
  return g.__valenced?.flux ?? g.Flux ?? null
}

function getAllStoreNames(): string[] {
  try {
    const flux = getFlux()
    if (!flux) return []
    const stores = flux._stores ?? flux.stores ?? flux._storeNames
    if (!stores) return []
    if (Array.isArray(stores)) return stores.map(String)
    return Object.keys(stores)
  } catch { return [] }
}

function getStoreByName(name: string): any {
  try {
    const flux = getFlux()
    if (!flux) return null
    return flux.getStore?.(name)
      ?? flux._stores?.[name]
      ?? flux.stores?.[name]
      ?? null
  } catch { return null }
}

// ── subscriptions ─────────────────────────────────────────────────────────────

const subscriptions = new Map<string, () => void>()
const watchListeners = new Set<(e: WatchEntry) => void>()

function emit(storeName: string, snapshot: unknown) {
  const entry: WatchEntry = {
    storeName,
    snapshot: (() => { try { return JSON.stringify(snapshot, null, 2) } catch { return String(snapshot) } })(),
    timestamp: Date.now(),
  }
  for (const fn of watchListeners) { try { fn(entry) } catch { /* */ } }
}

function subscribe(storeName: string): boolean {
  if (subscriptions.has(storeName)) return true
  const store = getStoreByName(storeName)
  if (!store) return false

  const handler = () => {
    try { emit(storeName, store.getState?.() ?? '(no getState)') } catch (e) { emit(storeName, { error: String(e) }) }
  }

  store.addChangeListener?.(handler)
  subscriptions.set(storeName, () => store.removeChangeListener?.(handler))
  return true
}

function unsubscribe(name: string) {
  subscriptions.get(name)?.()
  subscriptions.delete(name)
}

function unsubscribeAll() {
  for (const fn of subscriptions.values()) { try { fn() } catch { /* */ } }
  subscriptions.clear()
}

// ── UI ────────────────────────────────────────────────────────────────────────

function StorePickerModal({
  allStores,
  watched,
  onToggle,
  onClose,
}: {
  allStores: string[]
  watched: Set<string>
  onToggle: (name: string) => void
  onClose: () => void
}) {
  const { KeyboardAvoidingView, Modal, Platform, ScrollView, TextInput, TouchableOpacity, View } = ReactNative
  const { Button, Text } = Design

  const [filter, setFilter] = React.useState('')

  const visible = filter.length < 2
    ? allStores
    : allStores.filter(n => n.toLowerCase().includes(filter.toLowerCase()))

  return h(
    Modal,
    { transparent: true, animationType: 'slide', onRequestClose: onClose },
    h(
      View,
      {
        style: {
          flex: 1,
          backgroundColor: '#00000088',
          justifyContent: 'flex-end',
        },
      },
      h(
        KeyboardAvoidingView,
        { behavior: Platform.OS === 'ios' ? 'padding' : 'height' },
        h(
          View,
          {
            style: {
              backgroundColor: '#1e2124',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '75%',
              paddingBottom: 16,
            },
          },

          h(
            View,
            {
              style: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#2e3035',
              },
            },
            h(Text, { variant: 'heading-sm/semibold' }, `Stores (${allStores.length})`),
            h(Button, { text: 'Done', variant: 'primary', size: 'sm', onPress: onClose }),
          ),

          h(
            View,
            { style: { paddingHorizontal: 16, paddingVertical: 8 } },
            h(TextInput, {
              style: {
                backgroundColor: '#2b2d31',
                color: '#fff',
                padding: 10,
                borderRadius: 8,
                fontSize: 13,
              },
              placeholder: 'Filter stores…',
              placeholderTextColor: '#666',
              value: filter,
              onChangeText: setFilter,
              autoCapitalize: 'none',
            }),
          ),

          h(
            ScrollView,
            { keyboardShouldPersistTaps: 'handled' },
            visible.map(name =>
              h(
                TouchableOpacity,
                {
                  key: name,
                  onPress: () => onToggle(name),
                  style: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#2e303566',
                  },
                },
                h(
                  View,
                  {
                    style: {
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: watched.has(name) ? '#5865F2' : '#555',
                      backgroundColor: watched.has(name) ? '#5865F2' : 'transparent',
                      marginRight: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  },
                  watched.has(name)
                    ? h(Text, { variant: 'text-xs/bold', style: { color: '#fff' } }, '✓')
                    : null,
                ),
                h(Text, { variant: 'text-sm/medium' }, name),
              ),
            ),
          ),
        ),
      ),
    ),
  )
}

export function WatchTab() {
  const { ScrollView, TouchableOpacity, View } = ReactNative
  const { Button, Text } = Design

  const [watched, setWatched] = React.useState<Set<string>>(new Set())
  const [log, setLog] = React.useState<WatchEntry[]>([])
  const [showPicker, setShowPicker] = React.useState(false)
  const [allStores] = React.useState<string[]>(() => getAllStoreNames())
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null)

  React.useEffect(() => {
    const unsub = (entry: WatchEntry) => {
      setLog(prev => [entry, ...prev].slice(0, MAX_LOG))
    }
    watchListeners.add(unsub)
    return () => {
      watchListeners.delete(unsub)
      unsubscribeAll()
    }
  }, [])

  const toggleStore = (name: string) => {
    const next = new Set(watched)
    if (next.has(name)) {
      unsubscribe(name)
      next.delete(name)
    } else {
      subscribe(name)
      next.add(name)
    }
    setWatched(next)
  }

  const clearLog = () => setLog([])

  const copyLog = () => {
    const text = log
      .map(e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.storeName}\n${e.snapshot}`)
      .join('\n\n---\n\n')
    Clipboard.setString(text || 'No events.')
  }

  return h(
    View,
    { style: { flex: 1 } },

    showPicker
      ? h(StorePickerModal, {
          allStores,
          watched,
          onToggle: toggleStore,
          onClose: () => setShowPicker(false),
        })
      : null,

    // Header
    h(
      View,
      {
        style: {
          padding: 16,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#2e3035',
        },
      },
      h(Text, { variant: 'heading-md/semibold' }, 'Live Watch'),
      h(
        Text,
        { variant: 'text-sm/medium', color: 'text-muted' },
        allStores.length > 0
          ? `${allStores.length} stores available · ${watched.size} watched`
          : 'Flux not found — store list unavailable.',
      ),
      h(
        View,
        { style: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' } },
        h(Button, {
          text: 'Pick stores…',
          variant: 'primary',
          onPress: () => setShowPicker(true),
          disabled: allStores.length === 0,
        }),
        log.length > 0
          ? h(Button, { text: 'Copy log', variant: 'secondary', onPress: copyLog })
          : null,
        log.length > 0
          ? h(Button, { text: 'Clear', variant: 'destructive', onPress: clearLog })
          : null,
      ),

      // Watched chips
      watched.size > 0
        ? h(
            View,
            { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 } },
            Array.from(watched).map(name =>
              h(
                TouchableOpacity,
                {
                  key: name,
                  onPress: () => toggleStore(name),
                  style: {
                    backgroundColor: '#5865F222',
                    borderWidth: 1,
                    borderColor: '#5865F2',
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  },
                },
                h(Text, { variant: 'text-xs/semibold', color: 'text-link' }, name),
                h(Text, { variant: 'text-xs/medium', color: 'text-muted' }, ' ✕'),
              ),
            ),
          )
        : null,
    ),

    // Event log
    h(
      ScrollView,
      { style: { flex: 1 } },
      log.length === 0
        ? h(
            View,
            { style: { padding: 32, alignItems: 'center' } },
            h(
              Text,
              { variant: 'text-sm/medium', color: 'text-muted', style: { textAlign: 'center' } },
              watched.size === 0
                ? 'Select stores above to start watching for changes.'
                : 'Watching… waiting for store changes.',
            ),
          )
        : log.map((entry, i) =>
            h(
              TouchableOpacity,
              {
                key: i,
                onPress: () => setExpandedIdx(expandedIdx === i ? null : i),
                style: {
                  borderBottomWidth: 1,
                  borderBottomColor: '#2e303566',
                  padding: 12,
                },
              },
              h(
                View,
                { style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 } },
                h(Text, { variant: 'text-sm/semibold', color: 'text-link' }, entry.storeName),
                h(
                  Text,
                  { variant: 'text-xs/medium', color: 'text-muted' },
                  new Date(entry.timestamp).toLocaleTimeString(),
                ),
              ),
              h(
                Text,
                {
                  variant: 'text-xs/normal',
                  style: {
                    fontFamily: 'monospace',
                    color: '#3fb950',
                    lineHeight: 16,
                  },
                  numberOfLines: expandedIdx === i ? undefined : 3,
                },
                entry.snapshot,
              ),
            ),
          ),
    ),
  )
}
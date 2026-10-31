import { Design } from '@valenced/discord/design'
import { React, ReactNative } from '@valenced/react'
import {
  addWatchListener,
  clearAllWatches,
  getWatchedStores,
  unwatchStore,
  watchStore,
  type WatchEntry,
} from '../features/livewatch'

const h = (...args: any[]) => React.createElement(...args)

const MAX_LOG = 50

export function WatchTab() {
  const { ScrollView, TextInput, View } = ReactNative
  const { Button, TableRow, TableRowGroup, Text } = Design

  const [input, setInput] = React.useState('')
  const [watched, setWatched] = React.useState<string[]>([])
  const [log, setLog] = React.useState<WatchEntry[]>([])
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setWatched(getWatchedStores())

    const unsub = addWatchListener(entry => {
      setLog(prev => [entry, ...prev].slice(0, MAX_LOG))
    })

    return unsub
  }, [])

  const add = () => {
    const name = input.trim()
    if (!name) return
    const ok = watchStore(name)
    if (ok) {
      setWatched(getWatchedStores())
      setInput('')
      setError('')
    } else {
      setError(`Could not find store "${name}". Make sure the name is exact.`)
    }
  }

  const remove = (name: string) => {
    unwatchStore(name)
    setWatched(getWatchedStores())
  }

  const clearAll = () => {
    clearAllWatches()
    setWatched([])
    setLog([])
  }

  return h(
    ScrollView,
    { style: { flex: 1 } },
    h(
      View,
      { style: { padding: 16, gap: 12 } },
      h(Text, { variant: 'heading-md/semibold' }, 'Live Watch'),
      h(
        Text,
        { variant: 'text-sm/medium', color: 'text-muted' },
        'Subscribe to Flux stores and see their state updates in real time.',
      ),

      h(
        View,
        { style: { flexDirection: 'row', gap: 8, alignItems: 'center' } },
        h(TextInput, {
          style: {
            flex: 1,
            borderWidth: 1,
            borderColor: '#555',
            borderRadius: 8,
            padding: 8,
            color: '#fff',
          },
          placeholder: 'Store name, e.g. ChannelStore',
          placeholderTextColor: '#888',
          value: input,
          onChangeText: (t: string) => { setInput(t); setError('') },
          onSubmitEditing: add,
          returnKeyType: 'done',
        }),
        h(Button, { text: 'Watch', variant: 'primary', onPress: add }),
      ),

      error ? h(Text, { variant: 'text-sm/medium', color: 'text-danger' }, error) : null,

      watched.length > 0
        ? h(
            TableRowGroup,
            { title: 'Watching' },
            watched.map(name =>
              h(TableRow, {
                key: name,
                label: name,
                trailing: h(Button, {
                  text: 'Remove',
                  variant: 'secondary',
                  size: 'sm',
                  onPress: () => remove(name),
                }),
              }),
            ),
          )
        : null,

      watched.length > 0
        ? h(Button, { text: 'Clear all watches', variant: 'destructive', onPress: clearAll })
        : null,

      log.length > 0
        ? h(
            TableRowGroup,
            { title: `Event log (${log.length})` },
            log.map((entry, i) =>
              h(TableRow, {
                key: i,
                label: `${entry.storeName} — ${new Date(entry.timestamp).toLocaleTimeString()}`,
                subLabel: entry.snapshot,
                subLabelLineClamp: 4,
              }),
            ),
          )
        : watched.length > 0
          ? h(Text, { variant: 'text-sm/medium', color: 'text-muted' }, 'Waiting for store changes…')
          : null,
    ),
  )
}

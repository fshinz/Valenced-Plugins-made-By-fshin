import { Design } from '@valenced/discord/design'
import { React, ReactNative } from '@valenced/react'
import { CompatibilityTab } from './tabs/CompatibilityTab'
import { ComponentTab } from './tabs/ComponentTab'
import { ErrorsTab } from './tabs/ErrorsTab'
import { MetroTab } from './tabs/MetroTab'
import { SandboxTab } from './tabs/SandboxTab'
import { WatchTab } from './tabs/WatchTab'

const h = (...args: any[]) => React.createElement(...args)

type Tab = 'errors' | 'metro' | 'component' | 'compat' | 'watch' | 'sandbox'

const TABS: { id: Tab; label: string }[] = [
  { id: 'errors', label: 'Errors' },
  { id: 'metro', label: 'Metro' },
  { id: 'component', label: 'Component' },
  { id: 'compat', label: 'Compat' },
  { id: 'watch', label: 'Watch' },
  { id: 'sandbox', label: 'Sandbox' },
]

export function PluginDoctorSettings() {
  const { View, ScrollView } = ReactNative
  const { Text } = Design

  const [active, setActive] = React.useState<Tab>('errors')

  const tabBar = h(
    ScrollView,
    { horizontal: true, showsHorizontalScrollIndicator: false, style: { borderBottomWidth: 1, borderBottomColor: '#333' } },
    h(
      View,
      { style: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 4 } },
      TABS.map(tab =>
        h(
          Text,
          {
            key: tab.id,
            variant: active === tab.id ? 'text-md/semibold' : 'text-md/medium',
            color: active === tab.id ? 'text-link' : 'text-muted',
            style: {
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: active === tab.id ? '#1e40af22' : 'transparent',
            },
            onPress: () => setActive(tab.id),
          },
          tab.label,
        ),
      ),
    ),
  )

  let content: any = null
  if (active === 'errors') content = h(ErrorsTab, null)
  else if (active === 'metro') content = h(MetroTab, null)
  else if (active === 'component') content = h(ComponentTab, null)
  else if (active === 'compat') content = h(CompatibilityTab, null)
  else if (active === 'watch') content = h(WatchTab, null)
  else if (active === 'sandbox') content = h(SandboxTab, null)

  return h(
    View,
    { style: { flex: 1 } },
    tabBar,
    content,
  )
}

import type { PluginApi } from '@valenced/plugins/types'

// Set by index.tsx on start, read by SandboxTab.
export let pluginApi: PluginApi<any> | null = null

export function setPluginApi(api: PluginApi<any>) {
  pluginApi = api
}
import * as settings from '@valenced/discord/modules/settings'
import { setPluginApi } from './api'
import { DevLabSettings } from './settings'
import { bindStorage, recordError } from './storage'

const SETTINGS_KEY = 'shin.devlab.settings'

export default plugin({
  jsonStorage: {
    load: true,
    default: { entries: [], enabled: true },
  },
  SettingsComponent: DevLabSettings,

  start({ cleanup, plugin: pluginSelf, jsonStorage, logger }) {
    bindStorage(jsonStorage)
    setPluginApi(pluginSelf as any)

    const report = (error: unknown, context = 'DevLab') => { recordError(error, context).catch(() => {}) }
    try {
      ;(pluginSelf as any).reportError = (error: unknown) => report(error, 'Reported plugin error')
    } catch (error) { report(error, 'Failed to register error reporter') }

    const origHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.()
    try {
      ;(globalThis as any).ErrorUtils?.setGlobalHandler?.((error: Error, isFatal: boolean) => {
        report(error, isFatal ? 'Fatal error' : 'Unhandled error')
        origHandler?.(error, isFatal)
      })
    } catch (error) { report(error, 'Failed to install global error handler') }
    cleanup(() => {
      try { if (origHandler) (globalThis as any).ErrorUtils?.setGlobalHandler?.(origHandler) } catch { /* */ }
    })

    // Register a first-class route in Discord Settings, independently of the plugin manager page.
    const undo: Array<() => void> = []
    let stopped = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const sectionExists = () => {
      try { settings.addSettingsItemToSection('VALENCED', items => items)(); return true } catch { return false }
    }
    const placeSection = () => {
      if (stopped) return
      if (!sectionExists()) {
        attempts++
        if (attempts < 20) Promise.resolve().then(placeSection)
        else if (attempts < 500) retry = setTimeout(placeSection, 20)
        return
      }
      undo.push(settings.registerSettingsSection
        ? settings.registerSettingsSection(SETTINGS_KEY, { label: 'DevLab', settings: [SETTINGS_KEY], index: 1 })
        : settings.addSettingsItemToSection('VALENCED', SETTINGS_KEY))
      settings.refreshSettings()
    }
    const off = settings.onSettingsModulesLoaded(() => {
      undo.push(settings.registerSettingsItems({
        [SETTINGS_KEY]: {
          type: 'route',
          parent: null,
          IconComponent: () => null,
          useTitle: () => 'DevLab',
          screen: { route: SETTINGS_KEY, getComponent: () => DevLabSettings },
        },
      }))
      placeSection()
    })
    cleanup(off, () => {
      stopped = true
      clearTimeout(retry)
      undo.splice(0).forEach(fn => { try { fn() } catch { /* */ } })
      settings.refreshSettings()
    })
    logger?.log?.('DevLab started')
  },
})

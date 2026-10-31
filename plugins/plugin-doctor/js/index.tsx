import { React } from '@valenced/react'
import { PluginDoctorSettings } from './settings'
import { bindStorage, recordError } from './storage'

export default plugin({
  jsonStorage: {
    load: true,
    default: {
      entries: [],
      enabled: true,
    },
  },

  SettingsComponent: PluginDoctorSettings,

  start({ cleanup, plugin: pluginSelf, jsonStorage, logger }) {
    bindStorage(jsonStorage)

    const report = (error: unknown, context = 'Plugin Doctor') => {
      recordError(error, context).catch(() => {})
    }

    // Expose a reportError hook for other plugins to use.
    try {
      (pluginSelf as any).reportError = (error: unknown) => {
        report(error, 'Reported plugin error')
      }
    } catch (error) {
      report(error, 'Failed to register error reporter')
    }

    // Global unhandled error capture.
    const origHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.()
    try {
      (globalThis as any).ErrorUtils?.setGlobalHandler?.((error: Error, isFatal: boolean) => {
        report(error, isFatal ? 'Fatal error' : 'Unhandled error')
        origHandler?.(error, isFatal)
      })
    } catch (e) {
      report(e, 'Failed to install global error handler')
    }

    cleanup(() => {
      // Restore original handler on unload.
      try {
        if (origHandler) {
          (globalThis as any).ErrorUtils?.setGlobalHandler?.(origHandler)
        }
      } catch { /* */ }
    })

    logger?.log?.('Plugin Doctor started')
  },
})

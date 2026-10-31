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

  start({ cleanup, plugin, jsonStorage }) {
    bindStorage(jsonStorage)

    const report = (error: unknown, context = 'Plugin Doctor') => {
      recordError(error, context).catch(() => {})
    }

    try {
      plugin.reportError = (error: unknown) => {
        report(error, 'Reported plugin error')
      }
    } catch (error) {
      report(error, 'Failed to register error reporter')
    }

    cleanup(() => {
      // Reserved for future listeners, timers, and DevTools subscriptions.
    })
  },
})

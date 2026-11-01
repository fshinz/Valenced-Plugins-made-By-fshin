import { getInstalledPlugins } from '../native'

export type CompatibilityProblem = {
  id: string
  type: 'missing' | 'version' | 'api'
  message: string
}

export type CompatibilityReport = {
  pluginId: string
  pluginName: string
  compatible: boolean
  problems: CompatibilityProblem[]
}

// Known Valenced API surface — expand this list as the API grows.
const KNOWN_API: Record<string, string[]> = {
  '@valenced/discord/design': [
    'Design', 'TableRow', 'TableRowGroup', 'TableSwitchRow', 'Button', 'Text', 'Stack',
  ],
  '@valenced/react': ['React', 'ReactNative'],
  '@valenced/modules/finders': ['getModules', 'withProps', 'withName'],
  '@valenced/patcher': ['before', 'after', 'instead'],
  '@valenced/externals/react-native-clipboard': ['Clipboard'],
}

function semverSatisfies(version: string, range: string): boolean {
  // Simple range check: >=X <Y
  try {
    const parts = version.split('.').map(Number)
    const major = parts[0] ?? 0

    const geMatch = range.match(/>=(\d+)/)
    const ltMatch = range.match(/<(\d+)/)

    const ge = geMatch ? Number(geMatch[1]) : 0
    const lt = ltMatch ? Number(ltMatch[1]) : Infinity

    return major >= ge && major < lt
  } catch {
    return true
  }
}

export async function checkAllPlugins(): Promise<CompatibilityReport[]> {
  let plugins: any[]

  try {
    plugins = await getInstalledPlugins()
  } catch {
    // If native call fails, fall back to an empty list.
    plugins = []
  }

  if (!Array.isArray(plugins) || plugins.length === 0) {
    // Try to find plugins via the global plugin registry if the native call returned nothing.
    try {
      const registry = (globalThis as any).__valenced?.plugins
      if (registry) {
        plugins = Object.values(registry)
      }
    } catch {
      plugins = []
    }
  }

  return plugins.map((p: any): CompatibilityReport => {
    const problems: CompatibilityProblem[] = []
    const manifest = p.manifest ?? p

    // Check required valenced.api version against the running client.
    const requiredApi = manifest?.dependencies?.['valenced.api']?.version
    const clientVersion = (globalThis as any).__valenced?.version ?? '1.0.0'

    if (requiredApi && !semverSatisfies(clientVersion, requiredApi)) {
      problems.push({
        id: 'valenced.api',
        type: 'version',
        message: `Requires valenced.api ${requiredApi}, running ${clientVersion}`,
      })
    }

    // Check any declared import paths against our known API surface.
    const imports: string[] = manifest?.imports ?? []
    for (const imp of imports) {
      const known = KNOWN_API[imp]
      if (!known) {
        problems.push({
          id: imp,
          type: 'api',
          message: `Import path "${imp}" is not a recognized Valenced API.`,
        })
      }
    }

    return {
      pluginId: manifest?.id ?? p.id ?? 'unknown',
      pluginName: manifest?.name ?? p.name ?? 'Unknown Plugin',
      compatible: problems.length === 0,
      problems,
    }
  })
}
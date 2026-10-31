import { getInstalledPlugins } from '../native'

export type CompatibilityProblem = {
  id: string
  required?: string
  installed?: string
  type: 'missing' | 'disabled' | 'version' | 'legacy'
  optional: boolean
  message: string
}

export type CompatibilityReport = {
  pluginId: string
  pluginName: string
  compatible: boolean
  problems: CompatibilityProblem[]
}

type ManifestDependency = {
  version?: string
  optional?: boolean
}

type InstalledPlugin = {
  internal?: boolean
  enabled?: boolean
  manifest?: {
    id?: string
    name?: string
    version?: string
    dependencies?: Record<string, ManifestDependency>
  }
}

function versionParts(value: string) {
  return value
    .replace(/^v/i, '')
    .split(/[.-]/)[0]
    .split('.')
    .map(part => Number.parseInt(part, 10) || 0)
}

function compareVersions(left: string, right: string) {
  const a = versionParts(left)
  const b = versionParts(right)
  const length = Math.max(a.length, b.length)

  for (let index = 0; index < length; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference
  }

  return 0
}

function satisfies(version: string, range = '*') {
  if (!range || range === '*') return true

  return range
    .split(/\s+/)
    .filter(Boolean)
    .every(token => {
      const match = token.match(/^(>=|<=|>|<|=)?v?(\d+(?:\.\d+)*)$/)
      if (!match) return true

      const difference = compareVersions(version, match[2])
      const operator = match[1] ?? '='

      if (operator === '>=') return difference >= 0
      if (operator === '<=') return difference <= 0
      if (operator === '>') return difference > 0
      if (operator === '<') return difference < 0
      return difference === 0
    })
}

function isOptional(value: ManifestDependency | undefined) {
  return value?.optional === true
}

export async function checkPluginCompatibility(
  plugin: InstalledPlugin,
): Promise<CompatibilityReport> {
  const manifest = plugin.manifest ?? {}
  const dependencies = manifest.dependencies ?? {}
  const installed = await getInstalledPlugins()
  const byId = new Map<string, InstalledPlugin>()

  for (const item of installed ?? []) {
    const id = item.manifest?.id
    if (id) byId.set(id, item)
  }

  const problems: CompatibilityProblem[] = []

  for (const [id, requirement] of Object.entries(dependencies)) {
    const optional = isOptional(requirement)
    const found = byId.get(id)

    if (id.startsWith('revenge.')) {
      problems.push({
        id,
        required: requirement.version,
        type: 'legacy',
        optional,
        message: `${id} is a Revenge Next dependency and cannot run on Valenced.`,
      })
      continue
    }

    if (!found) {
      problems.push({
        id,
        required: requirement.version,
        type: 'missing',
        optional,
        message: `${id} is not installed.`,
      })
      continue
    }

    const installedVersion = found.manifest?.version ?? '0.0.0'

    if (found.enabled === false) {
      problems.push({
        id,
        required: requirement.version,
        installed: installedVersion,
        type: 'disabled',
        optional,
        message: `${id} is installed but disabled.`,
      })
      continue
    }

    if (!satisfies(installedVersion, requirement.version)) {
      problems.push({
        id,
        required: requirement.version,
        installed: installedVersion,
        type: 'version',
        optional,
        message: `${id} requires ${requirement.version ?? '*'}, but ${installedVersion} is installed.`,
      })
    }
  }

  return {
    pluginId: manifest.id ?? 'unknown',
    pluginName: manifest.name ?? manifest.id ?? 'Unknown plugin',
    compatible: problems.every(problem => problem.optional),
    problems,
  }
}

export async function checkAllPlugins() {
  const installed = await getInstalledPlugins()
  const reports: CompatibilityReport[] = []

  for (const plugin of installed ?? []) {
    if (!plugin.manifest || plugin.internal) continue
    reports.push(await checkPluginCompatibility(plugin))
  }

  return reports
}

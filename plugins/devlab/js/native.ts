import { callNativeMethod } from '@valenced/modules/native'

let usesEnvelope = false
let probed = false

export async function native<T = unknown>(name: string, args: unknown[] = []): Promise<T> {
  const reply = await (callNativeMethod as any)(name, args)
  probed = true

  if (reply && typeof reply === 'object' && !Array.isArray(reply)) {
    const keys = Object.keys(reply)

    if (keys.length === 1 && keys[0] === 'result') {
      usesEnvelope = true
      return reply.result as T
    }

    if (keys.length === 1 && keys[0] === 'error') {
      usesEnvelope = true
      const error = reply.error ?? {}
      throw Object.assign(new Error(error.message ?? error.code ?? 'Native API error'), {
        code: error.code,
        details: error.details,
      })
    }
  }

  return reply as T
}

export async function getInstalledPlugins() {
  return native<any[]>('valenced.plugins.list')
}

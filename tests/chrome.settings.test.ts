import { beforeEach, describe, expect, it } from 'vitest'

import {
  defaultSettings,
  loadSettings,
  patchSettings,
  saveSettings,
} from '../apps/chrome-extension/src/lib/settings.js'

type Storage = Record<string, unknown>

describe('chrome/settings', () => {
  let storage: Storage

  beforeEach(() => {
    storage = {}
    ;(globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: storage[key] }),
          set: async (obj: Record<string, unknown>) => {
            Object.assign(storage, obj)
          },
        },
      },
    }
  })

  it('loads defaults when storage is empty', async () => {
    const s = await loadSettings()
    expect(s).toEqual(defaultSettings)
  })

  it('normalizes model/length/language on save', async () => {
    await saveSettings({
      ...defaultSettings,
      token: 't',
      model: 'Auto',
      length: 'S',
      language: ' German ',
    })

    const raw = storage.settings as Record<string, unknown>
    expect(raw.model).toBe('auto')
    expect(raw.length).toBe('short')
    expect(raw.language).toBe('German')

    const loaded = await loadSettings()
    expect(loaded.model).toBe('auto')
    expect(loaded.length).toBe('short')
    expect(loaded.language).toBe('German')
  })

  it('patches settings and persists them', async () => {
    await patchSettings({ token: 'x', length: '20k', language: 'en' })
    const loaded = await loadSettings()
    expect(loaded.token).toBe('x')
    expect(loaded.length).toBe('20k')
    expect(loaded.language).toBe('en')
  })
})

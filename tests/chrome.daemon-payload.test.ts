import { describe, expect, it } from 'vitest'

import { buildDaemonRequestBody } from '../apps/chrome-extension/src/lib/daemon-payload.js'
import { defaultSettings } from '../apps/chrome-extension/src/lib/settings.js'

describe('chrome/daemon-payload', () => {
  it('builds a stable daemon request body', () => {
    const body = buildDaemonRequestBody({
      extracted: {
        url: 'https://example.com/article',
        title: 'Hello',
        text: 'Content',
        truncated: false,
      },
      settings: { ...defaultSettings, token: 't', model: 'auto', length: 'xl', language: 'auto' },
    })

    expect(body).toEqual({
      url: 'https://example.com/article',
      title: 'Hello',
      text: 'Content',
      truncated: false,
      model: 'auto',
      length: 'xl',
      language: 'auto',
      mode: 'auto',
      maxCharacters: defaultSettings.maxChars,
    })
  })
})

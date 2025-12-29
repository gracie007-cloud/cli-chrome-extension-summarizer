import { describe, expect, it } from 'vitest'

import { buildChatPageContent } from '../apps/chrome-extension/src/lib/chat-context.js'

describe('chrome/chat-context', () => {
  it('includes summary when transcript is within cap', () => {
    const content = buildChatPageContent({
      transcript: 'Hello transcript',
      summary: 'Short summary',
      summaryCap: 50,
    })

    expect(content).toBe('Summary (auto-generated):\nShort summary\n\nFull transcript:\nHello transcript')
  })

  it('skips summary when transcript exceeds cap', () => {
    const content = buildChatPageContent({
      transcript: 'x'.repeat(60),
      summary: 'Short summary',
      summaryCap: 50,
    })

    expect(content).toBe(`Full transcript:\n${'x'.repeat(60)}`)
  })

  it('skips summary when summary is empty', () => {
    const content = buildChatPageContent({
      transcript: 'Hello transcript',
      summary: '   ',
      summaryCap: 50,
    })

    expect(content).toBe('Full transcript:\nHello transcript')
  })
})

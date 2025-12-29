import type { ImageContent, Message, TextContent, UserMessage } from '@mariozechner/pi-ai'
import type { Attachment } from './attachments.js'

export type DocumentAttachment = {
  bytes: Uint8Array
  mediaType: string
  filename: string | null
}

export type DocumentPrompt = {
  kind: 'document'
  text: string
  document: DocumentAttachment
}

export type PromptPayload = string | Array<Message> | DocumentPrompt

export function userTextMessage(text: string, timestamp = Date.now()): UserMessage {
  return { role: 'user', content: text, timestamp }
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

export function userTextAndImageMessage({
  text,
  imageBytes,
  mimeType,
  timestamp = Date.now(),
}: {
  text: string
  imageBytes: Uint8Array
  mimeType: string
  timestamp?: number
}): UserMessage {
  const parts: Array<TextContent | ImageContent> = [
    { type: 'text', text },
    { type: 'image', data: bytesToBase64(imageBytes), mimeType },
  ]
  return { role: 'user', content: parts, timestamp }
}

export function buildDocumentPrompt({
  text,
  document,
}: {
  text: string
  document: DocumentAttachment
}): DocumentPrompt {
  return { kind: 'document', text, document }
}

export function buildPromptPayload({
  text,
  attachments,
}: {
  text: string
  attachments: Attachment[]
}): PromptPayload {
  if (attachments.length === 0) return text
  if (attachments.length !== 1) {
    throw new Error('Internal error: multiple attachments are not supported yet.')
  }
  const attachment = attachments[0]
  if (attachment.kind === 'image') {
    return [
      userTextAndImageMessage({
        text,
        imageBytes: attachment.bytes,
        mimeType: attachment.mediaType,
      }),
    ]
  }
  if (attachment.kind === 'document') {
    return buildDocumentPrompt({
      text,
      document: {
        bytes: attachment.bytes,
        mediaType: attachment.mediaType,
        filename: attachment.filename,
      },
    })
  }
  throw new Error(`Internal error: unsupported attachment kind \"${attachment.kind}\".`)
}

export function isDocumentPrompt(prompt: PromptPayload): prompt is DocumentPrompt {
  return (
    typeof prompt === 'object' &&
    prompt !== null &&
    !Array.isArray(prompt) &&
    (prompt as { kind?: unknown }).kind === 'document'
  )
}

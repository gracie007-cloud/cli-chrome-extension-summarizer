export type ChatContextInput = {
  transcript: string
  summary?: string | null
  summaryCap: number
}

export function buildChatPageContent({
  transcript,
  summary,
  summaryCap,
}: ChatContextInput): string {
  const cleanSummary = typeof summary === 'string' ? summary.trim() : ''
  const cleanTranscript = transcript.trim()

  if (!cleanSummary) {
    return `Full transcript:\n${cleanTranscript}`
  }

  if (summaryCap > 0 && cleanTranscript.length > summaryCap) {
    return `Full transcript:\n${cleanTranscript}`
  }

  return `Summary (auto-generated):\n${cleanSummary}\n\nFull transcript:\n${cleanTranscript}`
}

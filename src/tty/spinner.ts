import ora from 'ora'

export function startSpinner({
  text,
  enabled,
  stream,
}: {
  text: string
  enabled: boolean
  stream: NodeJS.WritableStream
}): {
  stop: () => void
  clear: () => void
  stopAndClear: () => void
  setText: (next: string) => void
} {
  if (!enabled) {
    return { stop: () => {}, clear: () => {}, stopAndClear: () => {}, setText: () => {} }
  }

  const oraStream = stream as typeof stream & {
    cursorTo?: (x: number, y?: number) => void
    clearLine?: (dir: number) => void
    moveCursor?: (dx: number, dy: number) => void
  }

  if (typeof oraStream.cursorTo !== 'function') oraStream.cursorTo = () => {}
  if (typeof oraStream.clearLine !== 'function') oraStream.clearLine = () => {}
  if (typeof oraStream.moveCursor !== 'function') oraStream.moveCursor = () => {}

  const clear = () => {
    // Keep output clean in scrollback.
    // `ora` clears the line, but we also hard-clear as a fallback.
    spinner.clear()
    stream.write('\r\u001b[2K')
  }

  const stop = () => {
    if (spinner.isSpinning) spinner.stop()
  }

  const stopAndClear = () => {
    stop()
    clear()
  }

  const setText = (next: string) => {
    spinner.text = next
    spinner.render?.()
  }

  const spinner = ora({
    text,
    stream: oraStream,
    // Match Sweetistics CLI vibe; keep it clean.
    spinner: 'dots12',
    color: 'cyan',
    discardStdin: true,
  }).start()

  return { stop, clear, stopAndClear, setText }
}

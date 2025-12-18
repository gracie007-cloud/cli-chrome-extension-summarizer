import { runCli } from './run.js'

export type CliMainArgs = {
  argv: string[]
  env: Record<string, string | undefined>
  fetch: typeof fetch
  stdout: NodeJS.WritableStream
  stderr: NodeJS.WritableStream
  exit: (code: number) => void
  setExitCode: (code: number) => void
}

export function handlePipeErrors(stream: NodeJS.WritableStream, exit: (code: number) => void) {
  stream.on('error', (error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code
    if (code === 'EPIPE') {
      exit(0)
      return
    }
    throw error
  })
}

export async function runCliMain({
  argv,
  env,
  fetch,
  stdout,
  stderr,
  exit,
  setExitCode,
}: CliMainArgs): Promise<void> {
  handlePipeErrors(stdout, exit)
  handlePipeErrors(stderr, exit)

  const verbose = argv.includes('--verbose') || argv.includes('--verbose=true')

  try {
    await runCli(argv, { env, fetch, stdout, stderr })
  } catch (error: unknown) {
    if ((stderr as unknown as { isTTY?: boolean }).isTTY) {
      stderr.write('\n')
    }

    if (verbose && error instanceof Error && typeof error.stack === 'string') {
      stderr.write(`${error.stack}\n`)
      const cause = (error as Error & { cause?: unknown }).cause
      if (cause instanceof Error && typeof cause.stack === 'string') {
        stderr.write(`Caused by: ${cause.stack}\n`)
      }
      setExitCode(1)
      return
    }

    const message =
      error instanceof Error ? error.message : error ? String(error) : 'Unknown error'
    stderr.write(`${message}\n`)
    setExitCode(1)
  }
}

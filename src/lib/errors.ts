/**
 * Loggable summary of an error that may carry personal data. Drizzle's query
 * errors put the bound values (sender email, message text) in `message`, so log
 * only the error's name and code.
 */
export function errorSummary(err: unknown): { name: string; code?: string } {
  if (!(err instanceof Error)) return { name: typeof err }
  const withCode = err as Error & { code?: unknown; cause?: { code?: unknown } }
  const code = withCode.code ?? withCode.cause?.code
  return { name: err.name, ...(typeof code === 'string' ? { code } : {}) }
}

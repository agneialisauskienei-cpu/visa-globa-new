export function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'
  if (error instanceof Error) return error.message

  if (typeof error === 'object') {
    const maybe = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    if (maybe.message) return maybe.message
    if (maybe.details) return maybe.details
    if (maybe.hint) return maybe.hint
    if (maybe.code) return `Klaidos kodas: ${maybe.code}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}
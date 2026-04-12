import { describe, expect, it } from 'vitest'
import { formatApiErrorResponse } from './client'

describe('formatApiErrorResponse', () => {
  it('parses structured error and message', () => {
    const out = formatApiErrorResponse(
      400,
      'Bad Request',
      JSON.stringify({ error: 'comparison_invalid', message: 'comparison.comparisonId is required.' }),
    )
    expect(out).toContain('comparison')
  })

  it('gives actionable copy when body is empty on 400', () => {
    expect(formatApiErrorResponse(400, 'Bad Request', '')).toMatch(/reload/i)
  })

  it('Phase 121: empty 401 uses calm sign-in line', () => {
    const out = formatApiErrorResponse(401, 'Unauthorized', '')
    expect(out).toMatch(/sign-in|Sign-in/i)
    expect(out).toMatch(/docs/i)
  })

  it('handles 413 without JSON', () => {
    const out = formatApiErrorResponse(413, 'Payload Too Large', '')
    expect(out).toMatch(/larger than the server accepts|request size/i)
  })

  it('Phase 119: ProblemDetails-style 500 without message uses title and calm fallback', () => {
    const out = formatApiErrorResponse(
      500,
      'Internal Server Error',
      JSON.stringify({
        title: 'Server error',
        detail: 'Something broke.',
      }),
    )
    expect(out).toContain('Server error')
    expect(out).toContain('Something broke')
  })

  it('Phase 119: ProblemDetails 500 with stack-like detail avoids echoing stack', () => {
    const out = formatApiErrorResponse(
      500,
      'Internal Server Error',
      JSON.stringify({
        title: 'Unhandled error',
        detail: '   at Program.Main()',
      }),
    )
    expect(out).toMatch(/Try again in a moment/)
    expect(out).not.toContain('at Program')
  })

  it('Phase 118: prefers JSON message for 413 payload_too_large when present', () => {
    const out = formatApiErrorResponse(
      413,
      'Payload Too Large',
      JSON.stringify({
        error: 'payload_too_large',
        message: 'Request body exceeded the configured limit.',
      }),
    )
    expect(out).toContain('exceeded')
    expect(out).not.toMatch(/payload_too_large:/)
  })

  it('Phase 117: prefers message over error code for export_request_incomplete', () => {
    const out = formatApiErrorResponse(
      400,
      'Bad Request',
      JSON.stringify({
        error: 'export_request_incomplete',
        message: 'Include either the saved analysis snapshot or raw plan JSON, then try exporting again.',
      }),
    )
    expect(out).toContain('snapshot')
    expect(out).not.toMatch(/export_request_incomplete:/)
  })

  it('Phase 117: prefers message over error code for request_body_invalid', () => {
    const out = formatApiErrorResponse(
      400,
      'Bad Request',
      JSON.stringify({
        error: 'request_body_invalid',
        message: 'This export request could not be read. Reload the page and try again.',
      }),
    )
    expect(out).toContain('could not be read')
    expect(out).not.toMatch(/request_body_invalid:/)
  })
})

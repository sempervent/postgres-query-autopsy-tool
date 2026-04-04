import { expect, test } from 'vitest'
import {
  artifactErrorBodyKicker,
  artifactErrorBannerTitle,
  artifactErrorBannerToneClass,
  artifactErrorTone,
} from './artifactErrorPresentation'

test('artifactErrorTone: access denied → denial', () => {
  expect(artifactErrorTone('Access denied for this analysis.')).toBe('denial')
})

test('artifactErrorTone: not found → warn', () => {
  expect(artifactErrorTone('No stored analysis for id abc.')).toBe('warn')
  expect(artifactErrorTone('No stored comparison for id xyz.')).toBe('warn')
})

test('artifactErrorTone: corrupt / 422 → warn', () => {
  expect(artifactErrorTone('artifact_corrupt: unreadable JSON')).toBe('warn')
  expect(artifactErrorTone('Stored artifact is corrupt or unreadable.')).toBe('warn')
})

test('artifactErrorTone: schema / 409 → warn', () => {
  expect(artifactErrorTone('Unsupported artifact_schema version (409).')).toBe('warn')
})

test('artifactErrorTone: generic → error', () => {
  expect(artifactErrorTone('Network failure')).toBe('error')
})

test('artifactErrorBannerToneClass maps to workstation banner modifiers', () => {
  expect(artifactErrorBannerToneClass('denial')).toBe('pqat-stateBanner--denial')
  expect(artifactErrorBannerToneClass('warn')).toBe('pqat-stateBanner--warn')
  expect(artifactErrorBannerToneClass('error')).toBe('pqat-stateBanner--error')
})

test('artifactErrorBodyKicker reflects tone', () => {
  expect(artifactErrorBodyKicker('denial')).toBe('Policy')
  expect(artifactErrorBodyKicker('warn')).toBe('Notice')
  expect(artifactErrorBodyKicker('error')).toBe('Error')
})

test('artifactErrorBannerTitle aligns with severity semantics', () => {
  expect(artifactErrorBannerTitle('Access denied.')).toBe('Access blocked')
  expect(artifactErrorBannerTitle('No stored analysis for id x')).toBe('Snapshot not found')
  expect(artifactErrorBannerTitle('corrupt row')).toBe('Artifact issue')
  expect(artifactErrorBannerTitle('unsupported schema 409')).toBe('Unsupported snapshot version')
  expect(artifactErrorBannerTitle('[Plan A] parse failed')).toBe('Plan text issue')
  expect(artifactErrorBannerTitle('Something else')).toBe('Could not complete request')
})

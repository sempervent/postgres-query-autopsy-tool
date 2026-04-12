import { describe, expect, it } from 'vitest'
import { PQAT_PREVIEW_FINDING_ID_ATTR, queryRankedFindingRow } from './analyzeEvidenceDom'

describe('queryRankedFindingRow', () => {
  it('returns the ranked ClickableRow, not a plan-band preview node with the same logical id', () => {
    document.body.innerHTML = `
      <section>
        <ol>
          <li ${PQAT_PREVIEW_FINDING_ID_ATTR}="rule-x:n1" id="preview-li"></li>
        </ol>
        <div id="analyze-ranked-findings">
          <div role="button" tabindex="0" data-finding-id="rule-x:n1" id="ranked-row">Finding</div>
        </div>
      </section>
    `
    const root = document.getElementById('analyze-ranked-findings')!
    const el = queryRankedFindingRow(root, 'rule-x:n1')
    expect(el?.id).toBe('ranked-row')
    expect(document.getElementById('preview-li')?.getAttribute(PQAT_PREVIEW_FINDING_ID_ATTR)).toBe('rule-x:n1')
  })
})

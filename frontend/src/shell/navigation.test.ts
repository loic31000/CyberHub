import { describe, expect, it } from 'vitest'
import { breadcrumbFor } from './navigation'

describe('shell breadcrumbs', () => {
  it('labels the isolated Knowledge Atlas route without adding it to global navigation', () => {
    expect(breadcrumbFor('/knowledge')).toEqual({ section: 'INTEL', label: 'Knowledge Atlas' })
  })

  it('keeps canonical route resolution unchanged', () => {
    expect(breadcrumbFor('/dashboard')).toEqual({ section: 'CORE', label: 'Dashboard' })
    expect(breadcrumbFor('/knowledge')).toEqual({ section: 'INTEL', label: 'Knowledge Atlas' })
  })
})

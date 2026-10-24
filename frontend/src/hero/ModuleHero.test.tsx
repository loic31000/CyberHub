// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ModuleHero } from './ModuleHero'

describe('ModuleHero narrow title wrapping', () => {
  afterEach(cleanup)

  it('offers line breaks between typed title glyphs while keeping its full accessible name', () => {
    render(<ModuleHero breadcrumb="OPS / CASE MANAGEMENT" title="INVESTIGATIONS" typeOnce="investigations" />)

    expect(screen.getByRole('heading', { name: 'INVESTIGATIONS' })).toBeTruthy()
    expect(document.querySelectorAll('.chh-title wbr')).toHaveLength('INVESTIGATIONS'.length - 1)
  })
})

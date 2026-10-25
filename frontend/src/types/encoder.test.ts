import { describe, expect, it, vi } from 'vitest'
import { transform } from './encoder'

describe('Encoder / Decoder transformations', () => {
  it('encodes ASCII and UTF-8 as Base64, and decodes padded or unpadded values with ASCII whitespace', () => {
    expect(transform('base64-encode', 'Hello')).toEqual({ output: 'SGVsbG8=', error: null })
    expect(transform('base64-decode', 'SGVsbG8=')).toEqual({ output: 'Hello', error: null })
    expect(transform('base64-decode', 'TWE=')).toEqual({ output: 'Ma', error: null })
    expect(transform('base64-decode', 'TWE')).toEqual({ output: 'Ma', error: null })
    expect(transform('base64-decode', ' SGVs\n bG8=\r\n')).toEqual({ output: 'Hello', error: null })
    expect(transform('base64-decode', '')).toEqual({ output: '', error: null })
  })

  it('round-trips accented, non-ASCII, emoji and multiline UTF-8 through Base64', () => {
    const value = 'Détection — 東京 🔒\nDeuxième ligne'
    const encoded = transform('base64-encode', value)
    expect(encoded.error).toBeNull()
    expect(encoded.output).toBe('RMOpdGVjdGlvbiDigJQg5p2x5LqsIPCflJIKRGV1eGnDqG1lIGxpZ25l')
    expect(transform('base64-decode', encoded.output)).toEqual({ output: value, error: null })
  })

  it('returns a clean French message for malformed Base64 and non-UTF-8 decoded bytes', () => {
    for (const invalid of ['%%%not-base64%%%', 'SGVsbG8===']) {
      const result = transform('base64-decode', invalid)
      expect(result.output).toBe('')
      expect(result.error).toBe('Base64 invalide : vérifiez les caractères et le padding.')
      expect(result.error).not.toMatch(/atob|Failed to execute|TypeError|stack/i)
    }
    expect(transform('base64-decode', '/w==').error).toBe('Le Base64 ne contient pas de texte UTF-8 valide.')
  })

  it('encodes and decodes URL components including reserved characters and Unicode', () => {
    const value = 'a b&?#/% café 🔒\n'
    const encoded = transform('url-encode', value)
    expect(encoded).toEqual({ output: 'a%20b%26%3F%23%2F%25%20caf%C3%A9%20%F0%9F%94%92%0A', error: null })
    expect(transform('url-decode', encoded.output)).toEqual({ output: value, error: null })
    expect(transform('url-decode', 'a+b')).toEqual({ output: 'a+b', error: null })
  })

  it('reports malformed URL escape and UTF-8 sequences without browser exception text', () => {
    for (const invalid of ['%', '%GG', '%E0%A4%A']) {
      const result = transform('url-decode', invalid)
      expect(result.output).toBe('')
      expect(result.error).toBe('URL invalide : la séquence encodée est mal formée.')
      expect(result.error).not.toMatch(/decodeURIComponent|URIError|stack/i)
    }
  })

  it('round-trips Hex as UTF-8, ignores whitespace on decode, and rejects malformed values', () => {
    const value = 'Café 東京 🔒\n'
    const encoded = transform('hex-encode', value)
    expect(encoded).toEqual({ output: '436166c3a920e69db1e4baac20f09f94920a', error: null })
    expect(transform('hex-decode', encoded.output)).toEqual({ output: value, error: null })
    expect(transform('hex-decode', '48 65\n6c6c 6f')).toEqual({ output: 'Hello', error: null })
    expect(transform('hex-decode', '48656C6C6F')).toEqual({ output: 'Hello', error: null })
    expect(transform('hex-decode', 'ff')).toEqual({ output: '\uFFFD', error: null })
    expect(transform('hex-decode', '4')).toMatchObject({ output: '', error: 'Hex invalide : nombre de caractères impair.' })
    expect(transform('hex-decode', '4G')).toMatchObject({ output: '', error: 'Hex invalide : caractères non hexadécimaux détectés.' })
  })

  it('keeps ROT13 limited to ASCII letters and HTML escaping contract stable', () => {
    expect(transform('rot13', 'Hello, été 🔒')).toEqual({ output: `Uryyb, \u00e9g\u00e9 \u{1F512}`, error: null })
    const html = `<tag a="x" b='y'>&/`
    const escaped = '&lt;tag a=&quot;x&quot; b=&#x27;y&#x27;&gt;&amp;&#x2F;'
    expect(transform('html-encode', html)).toEqual({ output: escaped, error: null })
    expect(transform('html-decode', escaped)).toEqual({ output: html, error: null })
    // Existing decoder applies its known entity replacements in sequence.
    expect(transform('html-decode', '&amp;lt;')).toEqual({ output: '<', error: null })
  })

  it('hides unexpected browser/implementation exceptions behind a generic user message', () => {
    vi.stubGlobal('TextEncoder', class { constructor() { throw new TypeError("Failed to execute 'encode' on 'TextEncoder'") } })
    try {
      const result = transform('base64-encode', 'Hello')
      expect(result.output).toBe('')
      expect(result.error).toBe('La transformation a échoué. Vérifiez la valeur saisie.')
      expect(result.error).not.toMatch(/TextEncoder|TypeError|Failed to execute|stack/i)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

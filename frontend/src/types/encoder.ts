export type EncoderGroup = 'Base64' | 'URL' | 'Hex' | 'ROT13' | 'HTML'

export type EncoderOperation =
  | 'base64-encode'
  | 'base64-decode'
  | 'url-encode'
  | 'url-decode'
  | 'hex-encode'
  | 'hex-decode'
  | 'rot13'
  | 'html-encode'
  | 'html-decode'

export interface EncoderConfig {
  id: EncoderOperation
  label: string
  group: EncoderGroup
}

export interface TransformResult {
  output: string
  error: string | null
}

export const OPERATIONS: EncoderConfig[] = [
  { id: 'base64-encode', label: 'Encode', group: 'Base64' },
  { id: 'base64-decode', label: 'Decode', group: 'Base64' },
  { id: 'url-encode',    label: 'Encode', group: 'URL'    },
  { id: 'url-decode',    label: 'Decode', group: 'URL'    },
  { id: 'hex-encode',    label: 'Encode', group: 'Hex'    },
  { id: 'hex-decode',    label: 'Decode', group: 'Hex'    },
  { id: 'rot13',         label: 'ROT13',  group: 'ROT13'  },
  { id: 'html-encode',   label: 'Encode', group: 'HTML'   },
  { id: 'html-decode',   label: 'Decode', group: 'HTML'   },
]

export const GROUPS: EncoderGroup[] = ['Base64', 'URL', 'Hex', 'ROT13', 'HTML']

// Encode UTF-8 string → base64 (full Unicode support, no deprecated escape())
function b64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const bin = Array.from(bytes, (b) => String.fromCodePoint(b)).join('')
  return btoa(bin)
}

// Decode base64 → UTF-8 string
function b64Decode(input: string): string {
  const bin = atob(input.trim())
  const bytes = Uint8Array.from(bin, (c) => c.codePointAt(0)!)
  return new TextDecoder().decode(bytes)
}

export function transform(op: EncoderOperation, input: string): TransformResult {
  if (!input) return { output: '', error: null }

  try {
    let output: string

    switch (op) {
      case 'base64-encode':
        output = b64Encode(input)
        break

      case 'base64-decode':
        output = b64Decode(input)
        break

      case 'url-encode':
        output = encodeURIComponent(input)
        break

      case 'url-decode':
        output = decodeURIComponent(input)
        break

      case 'hex-encode':
        output = Array.from(new TextEncoder().encode(input))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        break

      case 'hex-decode': {
        const hex = input.replace(/\s+/g, '')
        if (!/^[0-9a-fA-F]*$/.test(hex))
          throw new Error('Hex invalide : caractères non hexadécimaux détectés')
        if (hex.length % 2 !== 0)
          throw new Error('Hex invalide : nombre de caractères impair')
        const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
        output = new TextDecoder().decode(bytes)
        break
      }

      case 'rot13':
        output = input.replace(/[a-zA-Z]/g, (c) =>
          String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13))
        )
        break

      case 'html-encode':
        output = input
          .replace(/&/g,  '&amp;')
          .replace(/</g,  '&lt;')
          .replace(/>/g,  '&gt;')
          .replace(/"/g,  '&quot;')
          .replace(/'/g,  '&#x27;')
          .replace(/\//g, '&#x2F;')
        break

      case 'html-decode':
        output = input
          .replace(/&amp;/g,  '&')
          .replace(/&lt;/g,   '<')
          .replace(/&gt;/g,   '>')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&#39;/g,  "'")
          .replace(/&apos;/g, "'")
          .replace(/&#x2F;/g, '/')
        break

      default:
        output = input
    }

    return { output, error: null }
  } catch (e) {
    return {
      output: '',
      error: e instanceof Error ? e.message : 'Transformation échouée',
    }
  }
}

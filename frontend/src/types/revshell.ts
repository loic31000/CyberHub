export type RevShellLang =
  | 'bash' | 'sh' | 'python3' | 'python2' | 'php'
  | 'perl' | 'ruby' | 'powershell' | 'nc_traditional' | 'nc_openbsd'
  | 'java' | 'golang' | 'awk' | 'lua' | 'nodejs' | 'socat'

export type RevShellEncoding = 'none' | 'base64' | 'url'

export type RevShellOS = 'linux' | 'windows' | 'cross'

export interface RevShellParams {
  ip: string
  port: number
  lang: RevShellLang
  encode: RevShellEncoding
}

export interface RevShellResponse {
  payload: string
  listener: string
  lang: string
  os: RevShellOS
}

export interface RevShellLangConfig {
  id: RevShellLang
  label: string
  os: RevShellOS
}

export const LANG_CONFIGS: RevShellLangConfig[] = [
  { id: 'bash',           label: 'Bash',           os: 'linux'   },
  { id: 'sh',             label: 'sh',             os: 'linux'   },
  { id: 'python3',        label: 'Python 3',        os: 'linux'   },
  { id: 'python2',        label: 'Python 2',        os: 'linux'   },
  { id: 'php',            label: 'PHP',             os: 'linux'   },
  { id: 'perl',           label: 'Perl',            os: 'linux'   },
  { id: 'ruby',           label: 'Ruby',            os: 'linux'   },
  { id: 'nc_traditional', label: 'nc -e',          os: 'linux'   },
  { id: 'nc_openbsd',     label: 'nc mkfifo',      os: 'linux'   },
  { id: 'awk',            label: 'AWK',             os: 'linux'   },
  { id: 'lua',            label: 'Lua',             os: 'linux'   },
  { id: 'socat',          label: 'socat',           os: 'linux'   },
  { id: 'powershell',     label: 'PowerShell',      os: 'windows' },
  { id: 'java',           label: 'Java',            os: 'cross'   },
  { id: 'golang',         label: 'Go',              os: 'cross'   },
  { id: 'nodejs',         label: 'Node.js',         os: 'cross'   },
]

export const OS_GROUPS: { os: RevShellOS; label: string }[] = [
  { os: 'linux',   label: 'Linux' },
  { os: 'windows', label: 'Windows' },
  { os: 'cross',   label: 'Cross-Platform' },
]

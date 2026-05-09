import { useState, useEffect } from 'react'
import { Zap, Copy, Check, Terminal, AlertTriangle, Info } from 'lucide-react'
import { revshellApi } from '@/api/client'
import { LANG_CONFIGS, OS_GROUPS } from '@/types/revshell'
import type { RevShellLang, RevShellEncoding, RevShellResponse, RevShellOS } from '@/types/revshell'
import { toast } from '@/store/toast'
import clsx from 'clsx'

// ── OS badge ──────────────────────────────────────────────────────────────────

function OSBadge({ os }: { os: RevShellOS }) {
  const map: Record<RevShellOS, { label: string; cls: string }> = {
    linux:   { label: 'LINUX',   cls: 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]' },
    windows: { label: 'WINDOWS', cls: 'border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6]' },
    cross:   { label: 'CROSS',   cls: 'border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]' },
  }
  const { label, cls } = map[os]
  return (
    <span className={clsx('text-[9px] font-mono font-bold border px-1.5 py-0.5 uppercase tracking-wider', cls)}>
      {label}
    </span>
  )
}

// ── Code block with copy button ───────────────────────────────────────────────

interface CodeBlockProps {
  label: string
  code: string
  accent?: 'green' | 'yellow' | 'cyan'
  badge?: React.ReactNode
}

function CodeBlock({ label, code, accent = 'green', badge }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const colorMap = {
    green:  'text-[#10b981]',
    yellow: 'text-[#f59e0b]',
    cyan:   'text-cyan-400',
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Copié dans le presse-papiers')
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em]">{label}</span>
          {badge}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] font-mono text-[#64748b] hover:text-cyan-400 transition-colors"
        >
          {copied
            ? <><Check size={11} className="text-green-400" /> COPIÉ</>
            : <><Copy size={11} /> COPIER</>
          }
        </button>
      </div>
      <pre className={clsx(
        'bg-[#0a0f16] border border-[#1e2d40] px-4 py-3 text-sm font-mono whitespace-pre-wrap break-all leading-relaxed',
        colorMap[accent],
      )}>
        {code}
      </pre>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface FormState {
  ip: string
  port: number
  lang: RevShellLang
  encode: RevShellEncoding
}

const ENCODINGS: { id: RevShellEncoding; label: string }[] = [
  { id: 'none',   label: 'None'   },
  { id: 'base64', label: 'Base64' },
  { id: 'url',    label: 'URL'    },
]

export default function RevShellGenerator() {
  const [form, setForm] = useState<FormState>({
    ip: '',
    port: 4444,
    lang: 'bash',
    encode: 'none',
  })
  const [result, setResult]   = useState<RevShellResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Debounced fetch on any form change
  useEffect(() => {
    if (!form.ip.trim()) {
      setResult(null)
      setError(null)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await revshellApi.generate({
          ip: form.ip.trim(),
          port: form.port,
          lang: form.lang,
          encode: form.encode,
        })
        setResult(res)
      } catch {
        setError('Erreur de génération — vérifiez l\'IP')
        setResult(null)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [form])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const activeLangConfig = LANG_CONFIGS.find((l) => l.id === form.lang)!

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Zap className="text-cyan-400" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#ef4444] rounded-full animate-pulse shadow-[0_0_8px_#ef4444]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">REVSHELL GENERATOR // PAYLOAD</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              Génération de reverse shells — CTF, lab isolé &amp; tests autorisés uniquement
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">MODE</span>
          <span className="text-[#10b981]">STATELESS</span>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Form: LHOST / LPORT / Encoding */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">

          {/* LHOST */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em]">
              LHOST
            </label>
            <input
              type="text"
              value={form.ip}
              onChange={(e) => setField('ip', e.target.value)}
              placeholder="10.10.14.1"
              className="w-full bg-[#0a0f16] border border-[#1e2d40] text-sm font-mono text-[#f1f5f9] placeholder-[#2a3f55] px-3 py-2 focus:outline-none focus:border-cyan-500/40 transition-colors"
              spellCheck={false}
            />
          </div>

          {/* LPORT */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em]">
              LPORT
            </label>
            <input
              type="number"
              value={form.port}
              min={1}
              max={65535}
              onChange={(e) => setField('port', parseInt(e.target.value, 10) || 4444)}
              className="w-32 bg-[#0a0f16] border border-[#1e2d40] text-sm font-mono text-[#f1f5f9] px-3 py-2 focus:outline-none focus:border-cyan-500/40 transition-colors"
            />
          </div>

          {/* Encoding */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em]">
              ENCODING
            </label>
            <div className="flex">
              {ENCODINGS.map((enc) => (
                <button
                  key={enc.id}
                  onClick={() => setField('encode', enc.id)}
                  className={clsx(
                    'px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-y border-r first:border-l transition-colors',
                    form.encode === enc.id
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                      : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:text-cyan-400 hover:border-cyan-500/40',
                  )}
                >
                  {enc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Language selector — grouped by OS */}
        <div className="space-y-2.5">
          {OS_GROUPS.map(({ os, label }) => {
            const langs = LANG_CONFIGS.filter((l) => l.os === os)
            return (
              <div key={os} className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em] w-20 shrink-0 uppercase">
                  {label}
                </span>
                {langs.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setField('lang', l.id)}
                    className={clsx(
                      'text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 border transition-colors',
                      form.lang === l.id
                        ? os === 'linux'
                          ? 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]'
                          : os === 'windows'
                          ? 'border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6]'
                          : 'border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]'
                        : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-cyan-500/40 hover:text-cyan-400',
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {/* Status line */}
        <div className="flex items-center gap-3 font-mono text-[10px] text-[#4a6480]">
          <Terminal size={12} className="text-cyan-400 shrink-0" />
          <span>
            Lang :
            <span className="text-cyan-400 ml-1 uppercase tracking-wider">{activeLangConfig.label}</span>
          </span>
          <span className="text-[#2a3f55]">|</span>
          <span>
            OS :
          </span>
          <OSBadge os={activeLangConfig.os} />
          <span className="text-[#2a3f55]">|</span>
          <span>
            Encode :
            <span className="text-cyan-400 ml-1 uppercase tracking-wider">{form.encode}</span>
          </span>
          {loading && (
            <span className="text-[#64748b] animate-pulse">— génération…</span>
          )}
        </div>

        {/* Empty state */}
        {!form.ip.trim() && (
          <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-16 text-center">
            <Zap size={36} className="mb-3 text-[#1e2d40]" />
            <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">ENTREZ UN LHOST POUR GÉNÉRER</p>
            <p className="font-mono text-[10px] text-[#2a3f55] mt-1">ex: 10.10.14.1 ou votre IP tun0</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 border border-[#ef4444]/30 bg-[#1a0808] px-4 py-3 text-sm font-mono text-[#ef4444]">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-5">

            {/* Payload */}
            <CodeBlock
              label="PAYLOAD"
              code={result.payload}
              accent="green"
              badge={<OSBadge os={result.os} />}
            />

            {/* Listener */}
            <CodeBlock
              label="LISTENER"
              code={result.listener}
              accent="yellow"
              badge={
                <span className="text-[9px] font-mono border border-[#4a6480]/40 bg-[#4a6480]/10 text-[#4a6480] px-1.5 py-0.5 uppercase tracking-wider">
                  ATTACKER
                </span>
              }
            />

            {/* Encoding note */}
            {form.encode !== 'none' && (
              <div className="flex items-start gap-2 border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-[11px] font-mono text-[#8a9ab0]">
                <Info size={13} className="text-cyan-400 mt-0.5 shrink-0" />
                <span>
                  {form.encode === 'base64' && form.lang === 'powershell' &&
                    'PowerShell : encodage UTF-16LE → -EncodedCommand. Collez directement dans cmd.exe ou une invite PS.'}
                  {form.encode === 'base64' && form.lang !== 'powershell' &&
                    'Payload encodé en base64. La commande décode et exécute en une seule passe.'}
                  {form.encode === 'url' &&
                    'Payload URL-encodé. Utilisable dans un paramètre HTTP ou une injection web.'}
                </span>
              </div>
            )}

            {/* Note for source-code payloads */}
            {(result.lang === 'java' || result.lang === 'golang') && (
              <div className="flex items-start gap-2 border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-4 py-3 text-[11px] font-mono text-[#8a9ab0]">
                <Info size={13} className="text-[#f59e0b] mt-0.5 shrink-0" />
                <span>
                  {result.lang === 'java' &&
                    'Sauvegardez dans Exploit.java → javac Exploit.java → java Exploit'}
                  {result.lang === 'golang' &&
                    'Sauvegardez dans exploit.go → go run exploit.go'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && form.ip.trim() && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="h-3 w-16 bg-[#1e2d40] animate-pulse" />
              <div className="h-16 bg-[#0a0f16] border border-[#1e2d40] animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 bg-[#1e2d40] animate-pulse" />
              <div className="h-10 bg-[#0a0f16] border border-[#1e2d40] animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

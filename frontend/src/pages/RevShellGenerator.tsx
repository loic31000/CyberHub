import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Check, Info, ShieldAlert, Zap } from 'lucide-react'
import { revshellApi } from '@/api/client'
import { LANG_CONFIGS, OS_GROUPS } from '@/types/revshell'
import type { RevShellLang, RevShellEncoding, RevShellResponse } from '@/types/revshell'
import { toast } from '@/store/toast'
import RevShellHero from '@/revshell26/RevShellHero'
import { CodePanel, OS_LABEL, OsMark } from '@/revshell26/parts'
import '@/revshell26/revshell.css'

interface FormState {
  ip: string
  port: number
  lang: RevShellLang
  encode: RevShellEncoding
}

const ENCODINGS: { id: RevShellEncoding; label: string }[] = [
  { id: 'none', label: 'Aucun' },
  { id: 'base64', label: 'Base64' },
  { id: 'url', label: 'URL' },
]

export default function RevShellGenerator() {
  const [form, setForm] = useState<FormState>({ ip: '', port: 4444, lang: 'bash', encode: 'none' })
  const [portInput, setPortInput] = useState('4444')
  const [result, setResult] = useState<RevShellResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestGeneration = useRef(0)
  const portNumber = /^\d+$/.test(portInput.trim()) ? Number(portInput.trim()) : NaN
  const portValid = Number.isSafeInteger(portNumber) && portNumber >= 1 && portNumber <= 65535

  useEffect(() => {
    const ip = form.ip.trim()
    if (!ip || !portValid) {
      setResult(null)
      setError(null)
      setLoading(false)
      return
    }
    const generation = ++requestGeneration.current
    setResult(null)
    setError(null)
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const res = await revshellApi.generate({ ip, port: portNumber, lang: form.lang, encode: form.encode })
        if (generation === requestGeneration.current) setResult(res)
      } catch {
        if (generation === requestGeneration.current) {
          setError('Impossible de g\u00e9n\u00e9rer le payload.')
          setResult(null)
        }
      } finally {
        if (generation === requestGeneration.current) setLoading(false)
      }
    }, 300)
    return () => {
      window.clearTimeout(timer)
      if (generation === requestGeneration.current) requestGeneration.current += 1
    }
  }, [form, portInput, portValid, portNumber])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    requestGeneration.current += 1
    setResult(null)
    setError(null)
    setLoading(Boolean((key === 'ip' ? String(value) : form.ip).trim()) && portValid)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const setPortValue = (value: string) => {
    requestGeneration.current += 1
    setPortInput(value)
    setResult(null)
    setError(null)
    const candidate = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN
    const valid = Number.isSafeInteger(candidate) && candidate >= 1 && candidate <= 65535
    setLoading(Boolean(form.ip.trim()) && valid)
    if (valid) setForm(prev => ({ ...prev, port: candidate }))
  }
  const activeLangConfig = LANG_CONFIGS.find((l) => l.id === form.lang)!
  const hasHost = Boolean(form.ip.trim())

  const status = !hasHost ? { text: 'EN ATTENTE', mark: 'LHOST REQUIS' }
    : loading ? { text: 'GÉNÉRATION', tone: 'busy' as const }
    : !portValid ? { text: 'PORT INVALIDE', tone: 'warn' as const }
    : error ? { text: 'ERREUR', tone: 'warn' as const }
    : { text: `${activeLangConfig.label.toUpperCase()} · ${OS_LABEL[activeLangConfig.os].toUpperCase()}`, mark: form.encode === 'none' ? 'BRUT' : form.encode.toUpperCase() }

  return (
    <div className="rs26">
      <div className="rs26-frame">
        <RevShellHero status={status} />

        {/* Session + encoding configuration */}
        <section className="rs26-config" aria-label="Configuration de session">
          <div className="rs26-session">
            <span className="rs26-session-label">Session</span>
            <div className="rs26-endpoint">
              <div className="rs26-field">
                <label htmlFor="rs26-lhost">LHOST</label>
                <input id="rs26-lhost" type="text" value={form.ip} onChange={e => setField('ip', e.target.value)}
                  placeholder="10.10.14.1" inputMode="decimal" autoComplete="off" spellCheck={false} />
              </div>
              <span className="rs26-endpoint-sep" aria-hidden="true">:</span>
              <div className="rs26-field is-port">
                <label htmlFor="rs26-lport">LPORT</label>
                <input id="rs26-lport" type="text" inputMode="numeric" value={portInput}
                  aria-invalid={!portValid || undefined}
                  aria-describedby={!portValid ? 'rs26-port-error' : undefined}
                  onChange={e => setPortValue(e.target.value)} />
              </div>
            </div>
            {!portValid && <p id="rs26-port-error" className="rs26-error-msg" role="alert">Port requis: 1-65535.</p>}
          </div>

          <div className="rs26-encoding" role="group" aria-labelledby="rs26-enc-label">
            <span id="rs26-enc-label" className="rs26-session-label">Encodage</span>
            <div className="rs26-seg">
              {ENCODINGS.map(enc => (
                <button key={enc.id} type="button" className="rs26-seg-btn" aria-pressed={form.encode === enc.id}
                  onClick={() => setField('encode', enc.id)}>
                  {form.encode === enc.id && <Check size={13} aria-hidden="true" />}{enc.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Language selector, grouped by OS */}
        <section className="rs26-langs" aria-label="Langage">
          <span className="rs26-session-label">Langage</span>
          <div className="rs26-langs-grid">
            {OS_GROUPS.map(({ os, label }) => {
              const langs = LANG_CONFIGS.filter(l => l.os === os)
              return (
                <div key={os} className="rs26-langgroup" data-os={os} role="group" aria-label={label}>
                  <span className="rs26-langgroup-label"><i aria-hidden="true" />{label}</span>
                  <div className="rs26-seg is-wrap">
                    {langs.map(l => (
                      <button key={l.id} type="button" className="rs26-seg-btn" aria-pressed={form.lang === l.id}
                        aria-label={`${label} · ${l.label}`} onClick={() => setField('lang', l.id)}>
                        {form.lang === l.id && <Check size={13} aria-hidden="true" />}{l.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Results */}
        <div className="rs26-results" aria-live="polite">
          {!hasHost ? (
            <div className="rs26-state">
              <Zap size={30} aria-hidden="true" />
              <h2>Entrez un LHOST pour générer</h2>
              <p>ex : 10.10.14.1 ou votre IP tun0. La génération est automatique.</p>
            </div>
          ) : loading ? (
            <div className="rs26-skeleton" aria-busy="true">
              <p className="rs26-sr" role="status">Génération en cours…</p>
              <div className="rs26-skel-panel" aria-hidden="true"><span /><span className="is-tall" /></div>
              <div className="rs26-skel-panel" aria-hidden="true"><span /><span /></div>
            </div>
          ) : error ? (
            <div className="rs26-error" role="alert">
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <p className="rs26-error-title">Génération impossible</p>
                <p className="rs26-error-msg">{error}</p>
              </div>
            </div>
          ) : result ? (
            <>
              <CodePanel title="Payload" code={result.payload} variant="payload"
                badge={<OsMark os={String(result.os ?? '')} />} onCopy={() => toast.success('Payload copié')}
                onCopyError={() => toast.error('Impossible de copier le payload')} copyLabel="Copier le payload" />
              <CodePanel title="Listener" code={result.listener} variant="listener"
                badge={<span className="rs26-tag">Côté attaquant</span>} onCopy={() => toast.success('Listener copié')}
                onCopyError={() => toast.error('Impossible de copier le listener')} copyLabel="Copier le listener" />

              {form.encode !== 'none' && (
                <p className="rs26-note is-enc">
                  <Info size={14} aria-hidden="true" />
                  <span>
                    {form.encode === 'base64' && form.lang === 'powershell' &&
                      'PowerShell : encodage UTF-16LE → -EncodedCommand. Collez directement dans cmd.exe ou une invite PS.'}
                    {form.encode === 'base64' && form.lang !== 'powershell' &&
                      'Payload encodé en base64. La commande décode et exécute en une seule passe.'}
                    {form.encode === 'url' &&
                      'Payload URL-encodé. Utilisable dans un paramètre HTTP ou une injection web.'}
                  </span>
                </p>
              )}
              {(result.lang === 'java' || result.lang === 'golang') && (
                <p className="rs26-note is-build">
                  <Info size={14} aria-hidden="true" />
                  <span>
                    {result.lang === 'java' && 'Sauvegardez dans Exploit.java → javac Exploit.java → java Exploit'}
                    {result.lang === 'golang' && 'Sauvegardez dans exploit.go → go run exploit.go'}
                  </span>
                </p>
              )}
            </>
          ) : null}
        </div>

        <p className="rs26-usage">
          <ShieldAlert size={14} aria-hidden="true" />
          Réservé aux CTF, labs isolés et tests sur systèmes autorisés.
        </p>
      </div>
    </div>
  )
}

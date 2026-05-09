import { useState, useMemo } from 'react'
import { Binary, Copy, Check, ArrowLeftRight, Trash2, AlertTriangle } from 'lucide-react'
import { OPERATIONS, GROUPS, transform } from '@/types/encoder'
import type { EncoderOperation } from '@/types/encoder'
import { toast } from '@/store/toast'
import clsx from 'clsx'

export default function EncoderDecoder() {
  const [input, setInput]       = useState('')
  const [activeOp, setActiveOp] = useState<EncoderOperation>('base64-encode')
  const [copied, setCopied]     = useState(false)

  const result = useMemo(() => transform(activeOp, input), [activeOp, input])

  const handleCopy = () => {
    if (!result.output || result.error) return
    navigator.clipboard.writeText(result.output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Copié dans le presse-papiers')
    })
  }

  const handleSwap = () => {
    if (!result.output || result.error) return
    setInput(result.output)
  }

  const handleClear = () => setInput('')

  const activeConfig = OPERATIONS.find((o) => o.id === activeOp)!

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Binary className="text-cyan-400" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">ENCODER // DECODER</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              Transformations locales — Base64, URL, Hex, ROT13, HTML entities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">MODE</span>
          <span className="text-[#10b981]">LOCAL</span>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* Operation buttons */}
        <div className="space-y-2.5">
          {GROUPS.map((group) => (
            <div key={group} className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em] w-14 shrink-0 uppercase">
                {group}
              </span>
              {OPERATIONS.filter((op) => op.group === group).map((op) => (
                <button
                  key={op.id}
                  onClick={() => setActiveOp(op.id)}
                  className={clsx(
                    'text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 border transition-colors',
                    activeOp === op.id
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                      : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-cyan-500/40 hover:text-cyan-400'
                  )}
                >
                  {op.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Active operation indicator */}
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#4a6480]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00d4ff]" />
          OPÉRATION ACTIVE :
          <span className="text-cyan-400 tracking-widest uppercase">
            {activeConfig.group} → {activeConfig.label}
          </span>
        </div>

        {/* Textareas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em]">
                INPUT
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-[#2a3f55]">
                  {input.length} car.
                </span>
                <button
                  onClick={handleClear}
                  disabled={!input}
                  className="flex items-center gap-1 text-[10px] font-mono text-[#64748b] hover:text-[#ef4444] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={11} />
                  CLEAR
                </button>
              </div>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Entrez votre texte ici…"
              className="w-full h-64 bg-[#0a0f16] border border-[#1e2d40] text-sm font-mono text-[#f1f5f9] placeholder-[#2a3f55] px-4 py-3 resize-none focus:outline-none focus:border-cyan-500/40 transition-colors"
              spellCheck={false}
            />
          </div>

          {/* Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em]">
                OUTPUT
              </span>
              <div className="flex items-center gap-3">
                {!result.error && (
                  <span className="text-[10px] font-mono text-[#2a3f55]">
                    {result.output.length} car.
                  </span>
                )}
                <button
                  onClick={handleSwap}
                  disabled={!result.output || !!result.error}
                  title="Déplacer l'output vers l'input"
                  className="flex items-center gap-1 text-[10px] font-mono text-[#64748b] hover:text-cyan-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowLeftRight size={11} />
                  SWAP
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!result.output || !!result.error}
                  className="flex items-center gap-1 text-[10px] font-mono text-[#64748b] hover:text-cyan-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {copied
                    ? <><Check size={11} className="text-green-400" /> COPIÉ</>
                    : <><Copy size={11} /> COPIER</>
                  }
                </button>
              </div>
            </div>
            <textarea
              value={result.error ? '' : result.output}
              readOnly
              placeholder={result.error ? '' : 'Résultat…'}
              className={clsx(
                'w-full h-64 border text-sm font-mono px-4 py-3 resize-none focus:outline-none transition-colors',
                result.error
                  ? 'bg-[#1a0808] border-[#ef4444]/40 text-[#ef4444] placeholder-[#4a1a1a]'
                  : 'bg-[#0a0f16] border-[#1e2d40] text-[#10b981] placeholder-[#2a3f55]'
              )}
              spellCheck={false}
            />
            {result.error && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#ef4444]">
                <AlertTriangle size={12} className="shrink-0" />
                {result.error}
              </div>
            )}
          </div>
        </div>

        {/* Quick-ref table */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-4 space-y-2">
          <p className="text-[10px] font-mono font-bold text-[#4a6480] tracking-[0.15em] uppercase mb-3">
            Référence rapide
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1 text-[11px] font-mono">
            {[
              { op: 'Base64 encode', ex: 'Hello → SGVsbG8=' },
              { op: 'Base64 decode', ex: 'SGVsbG8= → Hello' },
              { op: 'URL encode',    ex: 'a b → a%20b' },
              { op: 'URL decode',    ex: 'a%20b → a b' },
              { op: 'Hex encode',    ex: 'Hi → 4869' },
              { op: 'Hex decode',    ex: '4869 → Hi' },
              { op: 'ROT13',        ex: 'Hello → Uryyb' },
              { op: 'HTML encode',  ex: '<b> → &lt;b&gt;' },
              { op: 'HTML decode',  ex: '&lt;b&gt; → <b>' },
            ].map(({ op, ex }) => (
              <div key={op} className="flex items-center gap-2 text-[#4a6480]">
                <span className="text-[#2a3f55]">›</span>
                <span className="text-[#64748b] shrink-0">{op}</span>
                <span className="text-[#2a3f55] truncate">{ex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

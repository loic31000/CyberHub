import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Crosshair, EyeOff, Wrench, BookOpen, ShieldAlert, Terminal,
  ChevronDown, ChevronRight, AlertCircle, Search, Layers,
  FileText, ArrowRight, Activity,
} from 'lucide-react'
import type {
  CorrelationResult,
  CorrelationLOLBin,
  CorrelationInvestigation,
  CorrelationAttackLayer,
  CorrelationNote,
} from '@/types/correlation'

interface Props {
  result: CorrelationResult | null
  loading: boolean
  error: string | null
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, icon, count, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-bg-hover hover:bg-bg-hover/80 transition-colors text-left"
      >
        <span className="text-cyber-cyan">{icon}</span>
        <span className="flex-1 font-medium text-text-primary text-sm">{title}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          count > 0 ? 'bg-cyber-cyan/15 text-cyber-cyan' : 'bg-gray-700/50 text-text-muted'
        }`}>
          {count}
        </span>
        {open ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
      </button>
      {open && <div className="p-4 bg-bg-secondary">{children}</div>}
    </div>
  )
}

function EmptyHint({ label }: { label: string }) {
  return <p className="text-text-muted text-xs italic">{label}</p>
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 60 ? 'text-red-400 border-red-500/40 bg-red-500/10'
    : pct >= 30 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
    : 'text-slate-400 border-slate-500/40 bg-slate-500/10'
  const label = pct >= 60 ? 'Confiance forte' : pct >= 30 ? 'Confiance modérée' : 'Confiance faible'
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${color}`}>
      <Activity size={12} />
      {label} — {pct}%
    </div>
  )
}

export default function CorrelationPanel({ result, loading, error }: Props) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-bg-hover animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400">
        <AlertCircle size={18} />
        <span className="text-sm">{error}</span>
      </div>
    )
  }

  if (!result) return null

  const investigations: CorrelationInvestigation[] = result.investigations ?? []
  const attackLayers: CorrelationAttackLayer[] = result.attack_layers ?? []
  const notes: CorrelationNote[] = result.notes ?? []
  const nextActions: string[] = result.next_actions ?? []
  const confidence = result.confidence ?? 0
  const rationale = result.rationale ?? ''

  return (
    <div className="space-y-3">
      {/* Header : confiance + rationale */}
      {rationale && (
        <div className="p-3 rounded-lg bg-bg-hover border border-border space-y-2">
          <ConfidenceBadge confidence={confidence} />
          <p className="text-xs text-text-secondary leading-relaxed">{rationale}</p>
        </div>
      )}

      {/* Section 1 — MITRE ATT&CK */}
      <Section
        title="MITRE ATT&CK"
        icon={<Crosshair size={16} />}
        count={result.techniques.length}
      >
        {result.techniques.length === 0 ? (
          <EmptyHint label="Aucune technique MITRE associée" />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1 px-2 text-text-muted font-medium">ID</th>
                <th className="text-left py-1 px-2 text-text-muted font-medium">Technique</th>
                <th className="text-left py-1 px-2 text-text-muted font-medium">Tactique</th>
              </tr>
            </thead>
            <tbody>
              {result.techniques.map((t) => (
                <tr
                  key={t.technique_id}
                  className="border-b border-border/50 hover:bg-bg-hover cursor-pointer"
                  onClick={() => navigate(`/mitre?id=${t.technique_id}`)}
                >
                  <td className="py-1.5 px-2 font-mono text-cyber-cyan">{t.technique_id}</td>
                  <td className="py-1.5 px-2 text-text-primary">{t.name}</td>
                  <td className="py-1.5 px-2 text-text-muted">{t.tactic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Section 2 — ATT&CK Layers */}
      <Section
        title="ATT&CK Layers"
        icon={<Layers size={16} />}
        count={attackLayers.length}
        defaultOpen={attackLayers.length > 0}
      >
        {attackLayers.length === 0 ? (
          <EmptyHint label="Aucun layer ATT&CK contenant ces techniques" />
        ) : (
          <ul className="space-y-1">
            {attackLayers.map((layer) => (
              <li key={layer.id}>
                <button
                  onClick={() => navigate(`/mitre/layers/${layer.id}`)}
                  className="text-xs text-text-secondary hover:text-cyber-cyan hover:underline transition-colors text-left"
                >
                  → {layer.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Section 3 — Investigations */}
      <Section
        title="Investigations liées"
        icon={<Search size={16} />}
        count={investigations.length}
        defaultOpen={investigations.length > 0}
      >
        {investigations.length === 0 ? (
          <EmptyHint label="Aucune investigation ne référence cet IOC" />
        ) : (
          <ul className="space-y-1.5">
            {investigations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/investigations/${inv.id}`)}
                  className="flex-1 text-xs text-text-secondary hover:text-cyber-cyan hover:underline transition-colors text-left"
                >
                  → {inv.title}
                </button>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  inv.status === 'open' ? 'bg-green-500/15 text-green-400'
                  : inv.status === 'closed' ? 'bg-gray-500/20 text-gray-400'
                  : 'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {inv.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Section 4 — CLOAK OpSec */}
      <Section
        title="CLOAK OpSec"
        icon={<EyeOff size={16} />}
        count={result.cloak_tactics.length}
      >
        {result.cloak_tactics.length === 0 ? (
          <EmptyHint label="Aucune tactique CLOAK associée" />
        ) : (
          <div className="space-y-2">
            {result.cloak_tactics.map((ct, i) => (
              <div key={i} className="p-2 rounded bg-bg-primary border border-border">
                <p className="text-sm font-semibold text-text-primary">{ct.name}</p>
                {ct.description && (
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{ct.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Section 5 — Playbooks suggérés */}
      <Section
        title="Playbooks suggérés"
        icon={<BookOpen size={16} />}
        count={result.playbooks.length}
      >
        {result.playbooks.length === 0 ? (
          <EmptyHint label="Aucun playbook suggéré" />
        ) : (
          <ul className="space-y-1">
            {result.playbooks.map((pb) => (
              <li key={pb.id}>
                <button
                  onClick={() => navigate(`/playbooks/${pb.id}`)}
                  className="text-xs text-text-secondary hover:text-cyber-cyan hover:underline transition-colors text-left"
                >
                  → {pb.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Section 6 — Outils recommandés */}
      <Section
        title="Outils recommandés"
        icon={<Wrench size={16} />}
        count={result.tools.length}
      >
        {result.tools.length === 0 ? (
          <EmptyHint label="Aucun outil recommandé" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {result.tools.map((tool, i) => (
              <button
                key={i}
                onClick={() => navigate('/tools')}
                className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-text-secondary hover:bg-cyber-cyan/20 hover:text-cyber-cyan transition-colors"
              >
                {tool.name}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Section 7 — CVE liées */}
      <Section
        title="CVE liées (CVSS ≥ 7.0)"
        icon={<ShieldAlert size={16} />}
        count={result.cves.length}
      >
        {result.cves.length === 0 ? (
          <EmptyHint label="Aucune CVE liée trouvée" />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1 px-2 text-text-muted font-medium">CVE</th>
                <th className="text-left py-1 px-2 text-text-muted font-medium">Description</th>
                <th className="text-right py-1 px-2 text-text-muted font-medium">CVSS</th>
              </tr>
            </thead>
            <tbody>
              {result.cves.map((cve) => (
                <tr key={cve.cve_id} className="border-b border-border/50">
                  <td className={`py-1.5 px-2 font-mono font-semibold ${cve.cvss_score >= 9 ? 'text-red-400' : 'text-orange-400'}`}>
                    {cve.cve_id}
                  </td>
                  <td className="py-1.5 px-2 text-text-muted">
                    {cve.description.length > 80 ? cve.description.slice(0, 80) + '…' : cve.description}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${cve.cvss_score >= 9 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {cve.cvss_score.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Section 8 — LOLBins / GTFOBins */}
      <Section
        title="LOLBins / GTFOBins"
        icon={<Terminal size={16} />}
        count={(result.lolbins ?? []).length}
      >
        {(result.lolbins ?? []).length === 0 ? (
          <EmptyHint label="Aucun LOLBin correspondant (hash ou domaine uniquement)" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(result.lolbins ?? []).map((lb: CorrelationLOLBin, i: number) => (
              <button
                key={i}
                onClick={() => navigate('/lolbins')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-text-secondary hover:bg-cyber-cyan/20 hover:text-cyber-cyan transition-colors"
              >
                <span className={lb.os === 'windows' ? 'text-blue-400' : 'text-orange-400'}>
                  {lb.os === 'windows' ? '⊞' : '🐧'}
                </span>
                {lb.name}
                {lb.category && (
                  <span className="text-text-muted">· {lb.category}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Section 9 — Notes liées */}
      <Section
        title="Notes pertinentes"
        icon={<FileText size={16} />}
        count={notes.length}
        defaultOpen={notes.length > 0}
      >
        {notes.length === 0 ? (
          <EmptyHint label="Aucune note ne mentionne cet IOC" />
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="p-2 rounded bg-bg-primary border border-border">
                <button
                  onClick={() => navigate('/notes')}
                  className="text-xs font-semibold text-text-primary hover:text-cyber-cyan transition-colors text-left"
                >
                  {note.title}
                </button>
                {note.excerpt && (
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{note.excerpt}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Section 10 — Actions suivantes */}
      {nextActions.length > 0 && (
        <div className="p-4 rounded-lg bg-cyber-cyan/5 border border-cyber-cyan/20">
          <p className="text-xs font-semibold text-cyber-cyan mb-2 flex items-center gap-1.5">
            <ArrowRight size={13} />
            Actions recommandées
          </p>
          <ul className="space-y-1">
            {nextActions.map((action, i) => (
              <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                <span className="text-cyber-cyan/60 mt-0.5">›</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-text-muted text-right pt-1">
        Généré le {new Date(result.generated_at).toLocaleString('fr-FR')}
        {' · '}
        {result.from_cache ? '⚡ Cache' : '🔄 Calculé'}
      </div>
    </div>
  )
}

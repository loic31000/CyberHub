import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Crosshair, EyeOff, Wrench, BookOpen, ShieldAlert, Terminal,
  ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react'
import type { CorrelationResult, CorrelationLOLBin } from '@/types/correlation'

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
}

function Section({ title, icon, count, children }: SectionProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-bg-hover hover:bg-bg-hover/80 transition-colors text-left"
      >
        <span className="text-cyber-cyan">{icon}</span>
        <span className="flex-1 font-medium text-text-primary text-sm">{title}</span>
        <span className="px-2 py-0.5 rounded-full bg-cyber-cyan/15 text-cyber-cyan text-xs font-bold">
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

  return (
    <div className="space-y-3">
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

      {/* Section 2 — CLOAK OpSec */}
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

      {/* Section 3 — Outils recommandés */}
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

      {/* Section 4 — Playbooks suggérés */}
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

      {/* Section 5 — CVE liées */}
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


      {/* Section 6 — LOLBins / GTFOBins */}
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

      {/* Footer */}
      <div className="text-xs text-text-muted text-right pt-1">
        Généré le {new Date(result.generated_at).toLocaleString('fr-FR')}
        {' · '}
        {result.from_cache ? '⚡ Cache' : '🔄 Calculé'}
      </div>
    </div>
  )
}

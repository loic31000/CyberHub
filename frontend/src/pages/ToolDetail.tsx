// frontend/src/pages/ToolDetail.tsx
import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { Tool } from '@/types'
import { ArrowLeft, Pencil, Scale, Trash2 } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import ToolsHero from '@/tools26/ToolsHero'
import {
  CategoryMark, ETHIC_HINT, ETHIC_LABEL, EthicMark, Markdown, OsMark, ethicOf, splitTags,
} from '@/tools26/parts'
import '@/tools26/tools.css'

/* The sheet reads as one technical document, in this order. */
const DOC_SECTIONS: { key: 'install' | 'usage' | 'examples' | 'procedure' | 'defense'; title: string; lead: string }[] = [
  { key: 'install', title: 'Installation', lead: 'Mise en place' },
  { key: 'usage', title: 'Utilisation', lead: 'Syntaxe et options' },
  { key: 'examples', title: 'Exemples', lead: 'Cas concrets' },
  { key: 'procedure', title: 'Procédure', lead: 'Déroulé opérationnel' },
  { key: 'defense', title: 'Contre-mesures', lead: 'Détection et défense' },
]

export default function ToolDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  useEffect(() => {
    toolsApi.get(Number(id))
      .then(setTool)
      .catch(() => setTool(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!tool) return
    setDeleteError(false)
    try {
      await toolsApi.delete(tool.id)
      navigate('/tools')
    } catch {
      setConfirmDelete(false)
      setDeleteError(true)
    }
  }

  if (loading) return (
    <div className="tl26"><div className="tl26-frame">
      <ToolsHero status={{ text: 'CHARGEMENT', tone: 'busy' }} />
      <p className="tl26-loading" role="status">Chargement de la fiche…</p>
    </div></div>
  )
  if (!tool) return (
    <div className="tl26"><div className="tl26-frame">
      <ToolsHero status={{ text: 'FICHE INTROUVABLE', tone: 'warn' }} />
      <div className="tl26-state is-error">
        <h2>Fiche non trouvée</h2>
        <p>Cet outil n'existe pas ou n'a pas pu être chargé.</p>
        <Link to="/tools" className="tl26-btn"><ArrowLeft size={15} aria-hidden="true" /> Retour à l'arsenal</Link>
      </div>
    </div></div>
  )

  const ethic = ethicOf(tool)
  const tags = splitTags(tool.tags)
  const sections = DOC_SECTIONS.filter(s => tool[s.key]?.trim())
  const hasFrame = ethic !== 'standard' || Boolean(tool.legal_notes?.trim() || tool.ethical_use_cases?.trim())
  const toc = [
    ...(tool.command_template?.trim() ? [{ id: 'tl26-s-command', title: 'Gabarit de commande' }] : []),
    ...(tool.input_schema?.trim() ? [{ id: 'tl26-s-schema', title: 'Schéma des paramètres' }] : []),
    ...sections.map(s => ({ id: `tl26-s-${s.key}`, title: s.title })),
    ...(hasFrame ? [{ id: 'tl26-s-frame', title: "Cadre d'emploi" }] : []),
    ...(tool.user_notes?.trim() ? [{ id: 'tl26-s-notes', title: 'Notes personnelles' }] : []),
  ]
  let n = 0
  const num = () => String(++n).padStart(2, '0')

  return (
    <div className="tl26">
      <div className="tl26-frame">
        <ToolsHero status={{ text: 'FICHE OUTIL', mark: `#${tool.id}` }} />

        <div className="tl26-crumbs">
          <Link to="/tools" className="tl26-link"><ArrowLeft size={14} aria-hidden="true" /> Arsenal</Link>
        </div>

        <article className="tl26-sheet" aria-labelledby="tl26-sheet-title">
          <header className="tl26-sheet-head" data-cat={tool.category}>
            <div className="tl26-sheet-title">
              <p className="tl26-sheet-kicker">{tool.sub_category || 'outil'}</p>
              <h2 id="tl26-sheet-title">{tool.name}</h2>
            </div>
            <div className="tl26-sheet-actions">
              <button type="button" className="tl26-btn" onClick={() => navigate(`/tools/${tool.id}/edit`)}>
                <Pencil size={15} aria-hidden="true" /> Modifier
              </button>
              <button type="button" className="tl26-btn is-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} aria-hidden="true" /> Supprimer
              </button>
            </div>
            <p className="tl26-sheet-desc">{tool.description}</p>
            <dl className="tl26-facts">
              <div><dt>Catégorie</dt><dd><CategoryMark category={tool.category} /></dd></div>
              <div><dt>Sous-catégorie</dt><dd className="is-mono">{tool.sub_category || '—'}</dd></div>
              <div><dt>Système</dt><dd><OsMark os={tool.os} /></dd></div>
              <div><dt>Niveau éthique</dt><dd><EthicMark level={ethic} /></dd></div>
            </dl>
            {tags.length > 0 && (
              <ul className="tl26-tags is-sheet" aria-label="Tags">
                {tags.map(tag => <li key={tag}>{tag}</li>)}
              </ul>
            )}
            {ethic !== 'standard' && (
              <p className="tl26-ethic-note" data-ethic={ethic}>
                <Scale size={15} aria-hidden="true" />
                <span><b>{ETHIC_LABEL[ethic]}.</b> {ETHIC_HINT[ethic]} <a href="#tl26-s-frame">Voir le cadre d'emploi</a></span>
              </p>
            )}
          </header>

          <div className="tl26-sheet-body">
            {toc.length > 0 && (
              <nav className="tl26-toc" aria-label="Sommaire de la fiche">
                <p>Sommaire</p>
                <ol>{toc.map(item => <li key={item.id}><a href={`#${item.id}`}>{item.title}</a></li>)}</ol>
              </nav>
            )}

            <div className="tl26-doc">
              {toc.length === 0 && <p className="tl26-empty-doc">Cette fiche ne contient pas encore de documentation opérationnelle.</p>}

              {tool.command_template?.trim() && (
                <section id="tl26-s-command" className="tl26-doc-section" aria-labelledby="tl26-h-command">
                  <header><span className="tl26-num">{num()}</span><h3 id="tl26-h-command">Gabarit de commande</h3><small>Paramètres entre {'{{ }}'}</small></header>
                  <pre className="tl26-template" tabIndex={0}><code>{tool.command_template}</code></pre>
                </section>
              )}

              {tool.input_schema?.trim() && (
                <section id="tl26-s-schema" className="tl26-doc-section" aria-labelledby="tl26-h-schema">
                  <header><span className="tl26-num">{num()}</span><h3 id="tl26-h-schema">Schéma des paramètres</h3><small>JSON</small></header>
                  <pre className="tl26-template" tabIndex={0}><code>{tool.input_schema}</code></pre>
                </section>
              )}

              {sections.map(s => (
                <section key={s.key} id={`tl26-s-${s.key}`} className="tl26-doc-section" data-kind={s.key} aria-labelledby={`tl26-h-${s.key}`}>
                  <header><span className="tl26-num">{num()}</span><h3 id={`tl26-h-${s.key}`}>{s.title}</h3><small>{s.lead}</small></header>
                  <Markdown>{tool[s.key]}</Markdown>
                </section>
              ))}

              {hasFrame && (
                <section id="tl26-s-frame" className="tl26-doc-section tl26-frame-section" data-ethic={ethic} aria-labelledby="tl26-h-frame">
                  <header><span className="tl26-num">{num()}</span><h3 id="tl26-h-frame">Cadre d'emploi</h3><small>Éthique et légal</small></header>
                  <dl className="tl26-frame-list">
                    <div><dt>Niveau</dt><dd><EthicMark level={ethic} /><span>{ETHIC_HINT[ethic]}</span></dd></div>
                    {tool.legal_notes?.trim() && <div><dt>Cadre légal</dt><dd className="is-prose">{tool.legal_notes}</dd></div>}
                    {tool.ethical_use_cases?.trim() && <div><dt>Cas d'usage autorisés</dt><dd className="is-prose">{tool.ethical_use_cases}</dd></div>}
                  </dl>
                </section>
              )}

              {tool.user_notes?.trim() && (
                <section id="tl26-s-notes" className="tl26-doc-section" aria-labelledby="tl26-h-notes">
                  <header><span className="tl26-num">{num()}</span><h3 id="tl26-h-notes">Notes personnelles</h3></header>
                  <Markdown>{tool.user_notes}</Markdown>
                </section>
              )}
            </div>
          </div>
        </article>
        {deleteError && <p className="tl26-field-error" role="alert">Suppression non confirmée. Vérifie le registre avant de réessayer.</p>}
      </div>

      <ConfirmModal
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="SUPPRIMER CET OUTIL ?"
        message="CETTE ACTION EST IRRÉVERSIBLE. L'OUTIL SERA DÉFINITIVEMENT EFFACÉ DE LA BASE."
      />
    </div>
  )
}

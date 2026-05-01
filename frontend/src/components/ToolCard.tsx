import { useNavigate } from 'react-router-dom'
import type { Tool } from '@/types'
import { Monitor, Terminal, Globe, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  tool: Tool
}

const osIcon = (os: Tool['os']) => {
  switch (os) {
    case 'windows': return <Monitor size={14} />
    case 'linux':   return <Terminal size={14} />
    case 'both':    return <Globe size={14} />
  }
}

const osLabel = (os: Tool['os']) => {
  switch (os) {
    case 'windows': return 'Windows'
    case 'linux':   return 'Linux'
    case 'both':    return 'Win + Linux'
  }
}

export default function ToolCard({ tool }: Props) {
  const navigate = useNavigate()

  const tags = tool.tags
    ? tool.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  return (
    <div
      className={clsx(
        'card cursor-pointer group',
        'hover:border-cyber-cyan/40 transition-all duration-200',
      )}
      onClick={() => navigate(`/tools/${tool.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-text-primary font-semibold group-hover:text-cyber-cyan transition-colors">
            {tool.name}
          </h3>
          <p className="text-text-muted text-xs mt-0.5 capitalize">{tool.sub_category}</p>
        </div>
        <ChevronRight
          size={16}
          className="text-text-muted group-hover:text-cyber-cyan group-hover:translate-x-0.5 transition-all mt-0.5"
        />
      </div>

      {/* Description */}
      <p className="text-text-secondary text-sm leading-relaxed mb-4 line-clamp-2">
        {tool.description}
      </p>

      {/* Footer badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={
          tool.category === 'offensive' ? 'badge-offensive' :
          tool.category === 'defensive' ? 'badge-defensive' :
          'badge-tag border-cyber-cyan/40 text-cyber-cyan'
        }>
          {tool.category}
        </span>
        <span className="badge-os flex items-center gap-1">
          {osIcon(tool.os)}
          {osLabel(tool.os)}
        </span>
        {tool.ethical_level === 'warning' && (
          <span className="badge-tag border-cyber-red/40 text-cyber-red" title="Outil offensif — pédagogique uniquement">
            ⚠️
          </span>
        )}
        {tool.ethical_level === 'elevated' && (
          <span className="badge-tag border-cyber-orange/40 text-cyber-orange" title="Audit autorisé requis">
            ⚡
          </span>
        )}
        {tags.slice(0, 3).map((tag) => (
          <span key={tag} className="badge-tag">{tag}</span>
        ))}
        {tags.length > 3 && (
          <span className="badge-tag">+{tags.length - 3}</span>
        )}
      </div>
    </div>
  )
}

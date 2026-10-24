import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Tool } from '@/types'
import { CATEGORY_CODE, CategoryMark, EthicMark, OsMark, ethicOf, splitTags } from '@/tools26/parts'

interface Props {
  tool: Tool
}

const TAGS_SHOWN = 3

/*
 * One entry of the arsenal register (styles in tools26/tools.css): a family
 * spine, the name as the real link (stretched over the entry), the
 * description, then classification and secondary tags.
 */
export default function ToolCard({ tool }: Props) {
  const tags = splitTags(tool.tags)
  return (
    <li className="tl26-entry" data-cat={tool.category}>
      <span className="tl26-spine" aria-hidden="true">{CATEGORY_CODE[tool.category] ?? '—'}</span>
      <div className="tl26-entry-main">
        <h3 className="tl26-entry-name">
          <Link to={`/tools/${tool.id}`}>{tool.name}</Link>
        </h3>
        {tool.sub_category && <p className="tl26-entry-sub">{tool.sub_category}</p>}
        <p className="tl26-entry-desc">{tool.description}</p>
      </div>
      <div className="tl26-entry-meta">
        <CategoryMark category={tool.category} />
        <OsMark os={tool.os} />
        <EthicMark level={ethicOf(tool)} />
        {tags.length > 0 && (
          <ul className="tl26-tags" aria-label="Tags">
            {tags.slice(0, TAGS_SHOWN).map(tag => <li key={tag}>{tag}</li>)}
            {tags.length > TAGS_SHOWN && <li className="is-more">+{tags.length - TAGS_SHOWN}</li>}
          </ul>
        )}
      </div>
      <ChevronRight className="tl26-entry-go" size={16} aria-hidden="true" />
    </li>
  )
}

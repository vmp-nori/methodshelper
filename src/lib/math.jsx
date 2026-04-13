import katex from 'katex'

/**
 * Render a string that may contain inline LaTeX delimited by $ ... $
 * or display-mode LaTeX delimited by $$ ... $$
 * Returns an array of {type: 'text'|'math'|'display', content: string} segments.
 */
export function parseAndRenderMath(text) {
  if (!text) return []

  const segments = []
  // Match $$...$$ first (display), then $...$
  // The $...$ pattern now handles escaped dollar signs \$
  const pattern = /(\$\$[\s\S]+?\$\$|\$(?:\\\$|[^$\n])+?\$)/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    const raw = match[0]
    const isDisplay = raw.startsWith('$$')
    const latex = isDisplay ? raw.slice(2, -2) : raw.slice(1, -1)
    try {
      const html = katex.renderToString(latex, {
        displayMode: isDisplay,
        throwOnError: false,
        output: 'html',
      })
      segments.push({ type: isDisplay ? 'display' : 'math', content: html })
    } catch {
      segments.push({ type: 'text', content: raw })
    }
    lastIndex = match.index + raw.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return segments
}

function renderTable(lines) {
  return (
    <div style={{ overflowX: 'auto', margin: '16px 0' }}>
      <table style={{ 
        borderCollapse: 'collapse', 
        width: 'auto', 
        minWidth: '200px',
        border: '1px solid rgba(72, 72, 72, 0.2)',
        fontSize: '0.9em'
      }}>
        <tbody>
          {lines.map((line, li) => {
            const cells = line.split('|').map(c => c.trim())
            return (
              <tr key={li} style={{ borderBottom: '1px solid rgba(72, 72, 72, 0.1)' }}>
                {cells.map((cell, ci) => (
                  <td key={ci} style={{ 
                    padding: '8px 16px', 
                    borderRight: '1px solid rgba(72, 72, 72, 0.1)',
                    textAlign: 'center'
                  }}>
                    <MathText text={cell} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function MathText({ text, className = '', style = {} }) {
  if (!text) return null
  
  const lines = text.split('\n')
  const blocks = []
  let currentTable = []

  lines.forEach((line) => {
    if (line.includes('|')) {
      currentTable.push(line)
    } else {
      if (currentTable.length > 0) {
        blocks.push({ type: 'table', content: currentTable })
        currentTable = []
      }
      if (line.trim() || blocks.length === 0 || (blocks.length > 0 && blocks[blocks.length-1].type === 'table')) {
        blocks.push({ type: 'text', content: line })
      }
    }
  })
  if (currentTable.length > 0) {
    blocks.push({ type: 'table', content: currentTable })
  }

  return (
    <div className={className} style={{ whiteSpace: 'pre-wrap', ...style }}>
      {blocks.map((block, bi) => {
        if (block.type === 'table') {
          return <div key={bi}>{renderTable(block.content)}</div>
        }
        
        const segments = parseAndRenderMath(block.content)
        return (
          <div key={bi} style={{ minHeight: '1.2em' }}>
            {segments.map((seg, i) => {
              if (seg.type === 'display') {
                return (
                  <span
                    key={i}
                    className="block my-2"
                    dangerouslySetInnerHTML={{ __html: seg.content }}
                  />
                )
              }
              if (seg.type === 'math') {
                return (
                  <span
                    key={i}
                    dangerouslySetInnerHTML={{ __html: seg.content }}
                  />
                )
              }
              return <span key={i}>{seg.content}</span>
            })}
          </div>
        )
      })}
    </div>
  )
}

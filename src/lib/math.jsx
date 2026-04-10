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
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
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

/**
 * React component that renders mixed text + math.
 * Segments with type 'display' are block-level; others are inline.
 */
export function MathText({ text, className = '' }) {
  if (!text) return null
  const segments = parseAndRenderMath(text)

  return (
    <span className={className}>
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
    </span>
  )
}

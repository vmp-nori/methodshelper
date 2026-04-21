import { useState, useEffect } from 'react'
import { MathText } from '../lib/math.jsx'

// Strip "Step N:", "N.", "ANSWER:" etc. from the start of a description line
function cleanDesc(text) {
  return text
    .replace(/^step\s*\d+[:.]\s*/i, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^answer[:\s]*/i, '')
    .trim()
}

// Parse AI text into [{description, math}] pairs.
// The last step is always rendered as the answer by the caller.
function parseSteps(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const steps = []
  let pending = null

  for (const line of lines) {
    const isMathBlock = line.startsWith('$$') && line.endsWith('$$') && line.length > 4
    if (isMathBlock) {
      steps.push({ description: pending !== null ? cleanDesc(pending) : null, math: line })
      pending = null
    } else {
      if (pending !== null) steps.push({ description: cleanDesc(pending), math: null })
      pending = line
    }
  }
  if (pending !== null) steps.push({ description: cleanDesc(pending), math: null })

  // Drop a trailing math-only step that duplicates the previous step's math
  if (steps.length >= 2) {
    const last = steps[steps.length - 1]
    const prev = steps[steps.length - 2]
    if (!last.description && last.math && prev.math && last.math === prev.math) {
      steps.pop()
    }
  }

  return steps.filter(s => s.description || s.math)
}

function buildPrompt(questionText, partLabel, partText) {
  const q = [questionText, partLabel ? `Part ${partLabel}: ${partText || ''}` : '']
    .filter(Boolean).join('\n\n').trim()
  return `\
Solve this step by step with all algebraic manipulations shown.

For each step:
1. Write a brief description (max 8 words, start with a capital letter, no period) of what you are doing
2. On the very next line, write the mathematical working in a KaTeX block: $$...$$
3. Repeat for every step

The last step should show the final answer. Do not add any extra text or repeat the answer after the last $$...$$ block.

Question:
${q}`
}

function buildContents(messages, newText) {
  return [
    ...messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: newText }] },
  ]
}

export default function GeminiChat({ isOpen, questionText, partLabel, partText }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const apiKey = localStorage.getItem('gemini_api_key')
  const model = localStorage.getItem('gemini_model') || 'gemini-1.5-flash-8b'
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  // ── Initial fetch ──
  const fetchInitial = async () => {
    if (!apiKey) return
    setError(null)
    setLoading(true)
    setMessages([])
    
    let attempt = 0
    const maxRetries = 2

    while (attempt <= maxRetries) {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildPrompt(questionText, partLabel, partText) }] }],
            generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 },
          }),
        })

        if (res.status === 503) {
          if (attempt < maxRetries) {
            attempt++
            await new Promise(r => setTimeout(r, 800 * attempt))
            continue
          }
          throw new Error('API is currently overloaded (High Demand). Please try again.')
        }
        if (res.status === 429) throw new Error('Rate limit reached. Please wait a moment.')

        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.'
        setMessages([{ role: 'assistant', text: reply }])
        break // Success
      } catch (err) {
        if (attempt >= maxRetries) {
          setError(err.message)
          break
        }
        attempt++
        await new Promise(r => setTimeout(r, 800 * attempt))
      } finally {
        if (attempt >= maxRetries || messages.length > 0) setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (isOpen) fetchInitial()
  }, [isOpen, questionText, partLabel, partText])

  // ── Follow-up send ──
  async function sendFollowUp() {
    if (!input.trim() || !apiKey || loading) return
    const userText = input.trim()
    setInput('')
    const next = [...messages, { role: 'user', text: userText }]
    setMessages(next)
    setLoading(true)
    setError(null)
    try {
      let attempt = 0
      const maxRetries = 2
      
      while (attempt <= maxRetries) {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: buildContents(messages, userText),
            generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 },
          }),
        })

        if (res.status === 503) {
          if (attempt < maxRetries) {
            attempt++
            await new Promise(r => setTimeout(r, 800 * attempt))
            continue
          }
          throw new Error('API is currently overloaded (High Demand). Please try again.')
        }
        if (res.status === 429) throw new Error('Rate limit reached. Please wait a moment.')

        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.'
        setMessages(prev => [...prev, { role: 'assistant', text: reply }])
        break // Success
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Initial AI response → step cards
  const firstAI = messages.find(m => m.role === 'assistant')

  // Follow-up thread only begins after the first user message
  const firstUserIdx = messages.findIndex(m => m.role === 'user')
  const followUps = firstUserIdx >= 0 ? messages.slice(firstUserIdx) : []

  return (
      <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
      {!apiKey ? (
        <NoApiKey />
      ) : (
        <>
          {loading && !firstAI && <LoadingDots label="Generating working out" />}
          {firstAI && <StepList text={firstAI.text} />}
          {error && <ErrorBanner message={error} onRetry={messages.length === 0 ? fetchInitial : sendFollowUp} />}

          {/* Follow-up thread (user + AI pairs, starts after first user message) */}
          {followUps.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {followUps.map((m, i) => (
                <div key={i} style={{ padding: '14px 0', borderTop: '1px solid rgba(72,72,72,0.08)' }}>
                  {m.role === 'user' ? (
                    <p style={{ margin: 0, ...bodyTextStyle('#484848') }}>
                      <span style={{ fontWeight: 700, color: '#9f9d9d', marginRight: 6 }}>You:</span>
                      {m.text}
                    </p>
                  ) : (
                    <MathText text={m.text} style={mathStyle('#e7e5e5')} />
                  )}
                </div>
              ))}
            </div>
          )}

          {loading && firstAI && (
            <div style={{ borderTop: '1px solid rgba(72,72,72,0.08)', paddingTop: 14 }}>
              <LoadingDots />
            </div>
          )}

          {/* Follow-up input */}
          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollowUp() }
              }}
              placeholder="Ask a follow-up question..."
              disabled={loading}
              style={{
                flex: 1,
                background: '#171717',
                border: '1px solid rgba(72,72,72,0.2)',
                borderRadius: 10,
                padding: '12px 16px',
                color: '#e7e5e5',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                minWidth: '200px'
              }}
            />
            <button
              onClick={sendFollowUp}
              disabled={loading || !input.trim()}
              style={{
                padding: '0 20px',
                background: input.trim() && !loading ? '#c799ff' : '#1f2020',
                color: input.trim() && !loading ? '#0e0e0e' : '#484848',
                border: 'none',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                fontFamily: 'Space Grotesk, sans-serif',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              Send
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes woDot {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StepList({ text }) {
  const steps = parseSteps(text)
  return (
    <div style={{ marginTop: 20 }}>
      {steps.map((step, i) => {
        const isAnswer = i === steps.length - 1
        return (
          <div
            key={i}
            style={{
              padding: isAnswer ? 0 : '14px 0',
              marginTop: isAnswer ? 20 : 0,
              borderBottom: isAnswer ? 'none' : '1px solid rgba(72,72,72,0.1)',
            }}
          >
            {isAnswer ? (
              /* Answer block with purple tint */
              <div style={{
                background: 'rgba(199,153,255,0.07)',
                border: '1px solid rgba(199,153,255,0.18)',
                borderRadius: 12,
                padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#c799ff', flexShrink: 0 }} />
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
                    textTransform: 'uppercase', color: '#c799ff',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    Answer
                  </span>
                </div>
                {step.math && (
                  <MathText text={step.math} style={mathStyle('#c799ff')} />
                )}
                {!step.math && step.description && (
                  <MathText text={step.description} style={mathStyle('#c799ff')} />
                )}
              </div>
            ) : (
              <>
                {/* Step number + description */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: 'rgba(199,153,255,0.7)',
                    fontFamily: 'Space Grotesk, sans-serif',
                    flexShrink: 0,
                    minWidth: 18,
                  }}>
                    {i + 1}.
                  </span>
                  {step.description && (
                    <span style={{
                      fontSize: 15, color: '#e7e5e5',
                      fontFamily: 'Inter, sans-serif', lineHeight: 1.4,
                    }}>
                      {step.description}
                    </span>
                  )}
                </div>
                {step.math && (
                  <MathText text={step.math} style={mathStyle('#e7e5e5')} />
                )}
                {!step.math && step.description && (
                  <MathText text={step.description} style={mathStyle('#e7e5e5')} />
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LoadingDots({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
      {label && <span style={bodyTextStyle('#484848')}>{label}</span>}
      {[0, 0.18, 0.36].map((d, i) => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: label ? '#c799ff' : '#484848',
          animation: `woDot 1.4s infinite ease-in-out ${d}s`,
        }} />
      ))}
    </div>
  )
}

function NoApiKey() {
  return (
    <div style={{
      padding: 20,
      background: 'rgba(199,153,255,0.05)',
      borderRadius: 12,
      border: '1px dashed rgba(199,153,255,0.2)',
      textAlign: 'center',
    }}>
      <p style={{ ...bodyTextStyle('#9f9d9d'), margin: '0 0 12px' }}>
        Set up your Gemini API key in settings to see working out.
      </p>
      <button
        onClick={() => window.location.href = '/settings'}
        style={{
          background: '#c799ff', color: '#0e0e0e', border: 'none',
          borderRadius: 6, padding: '8px 16px',
          fontSize: 12, fontWeight: 700,
          fontFamily: 'Space Grotesk, sans-serif',
          cursor: 'pointer',
        }}
      >
        Go to Settings
      </button>
    </div>
  )
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{
      marginTop: 16, padding: '12px 16px',
      background: 'rgba(239,68,68,0.1)',
      borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)',
      color: '#ef4444',
      fontSize: 13, fontFamily: 'Inter, sans-serif',
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start'
    }}>
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6, color: '#ef4444', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
        >
          Retry
        </button>
      )}
    </div>
  )
}

// ── Style helpers ───────────────────────────────────────────────────────────

function bodyTextStyle(color = '#e7e5e5') {
  return { fontSize: 13, fontFamily: 'Inter, sans-serif', color, lineHeight: 1.6 }
}

function mathStyle(color = '#e7e5e5') {
  return { fontSize: 15, color, lineHeight: 1.8, fontFamily: 'Inter, sans-serif' }
}

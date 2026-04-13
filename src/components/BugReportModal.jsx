import { useState } from 'react'
import { supabase } from '../lib/supabase'

const REPORT_TYPES = [
  { id: 'wrong-answer',   label: 'Wrong answer',    desc: 'The shown answer is incorrect' },
  { id: 'wrong-question', label: 'Wrong question',  desc: 'Question text doesn\'t match the textbook' },
  { id: 'missing',        label: 'Missing content', desc: 'Question or answer not loading' },
  { id: 'app-bug',        label: 'App bug',         desc: 'Something is broken' },
  { id: 'suggestion',     label: 'Suggestion',      desc: 'Feature or improvement idea' },
  { id: 'other',          label: 'Other',            desc: '' },
]

export default function BugReportModal({ onClose, context }) {
  const [type, setType]           = useState(null)
  const [description, setDesc]    = useState('')
  const [status, setStatus]       = useState('idle') // idle | submitting | success | error

  async function handleSubmit(e) {
    e.preventDefault()
    if (!type) return
    setStatus('submitting')
    try {
      const { error } = await supabase.functions.invoke('send-bug-report', {
        body: { type: REPORT_TYPES.find(t => t.id === type)?.label ?? type, description, context },
      })
      if (error) throw error
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          animation: 'backdropIn 0.2s ease',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%', maxWidth: '480px',
            background: '#131313',
            borderRadius: '14px',
            border: '1px solid rgba(72,72,72,0.15)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {status === 'success' ? (
            <SuccessState onClose={onClose} />
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '24px 24px 20px',
                borderBottom: '1px solid rgba(72,72,72,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px', lineHeight: 1 }}>⚑</span>
                  <h2 style={{
                    margin: 0, fontSize: '15px', fontWeight: '600',
                    color: '#e7e5e5', fontFamily: 'Space Grotesk, sans-serif',
                    letterSpacing: '-0.01em',
                  }}>
                    Report an issue
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#484848', fontSize: '18px', lineHeight: 1, padding: '2px',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#9f9d9d'}
                  onMouseLeave={e => e.currentTarget.style.color = '#484848'}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                {/* Type picker */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block', fontSize: '9px', letterSpacing: '0.2em',
                    textTransform: 'uppercase', color: '#9f9d9d', fontWeight: '700',
                    marginBottom: '10px', fontFamily: 'Inter, sans-serif',
                  }}>
                    What's the issue?
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {REPORT_TYPES.map(t => {
                      const selected = type === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setType(t.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '11px 14px',
                            background: selected ? 'rgba(199,153,255,0.07)' : '#0e0e0e',
                            border: `1px solid ${selected ? 'rgba(199,153,255,0.3)' : 'rgba(72,72,72,0.1)'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (!selected) e.currentTarget.style.borderColor = 'rgba(199,153,255,0.2)'
                          }}
                          onMouseLeave={e => {
                            if (!selected) e.currentTarget.style.borderColor = 'rgba(72,72,72,0.1)'
                          }}
                        >
                          <div>
                            <div style={{
                              fontSize: '13px', fontWeight: '500',
                              color: selected ? '#c799ff' : '#e7e5e5',
                              fontFamily: 'Inter, sans-serif',
                              marginBottom: t.desc ? '2px' : 0,
                            }}>
                              {t.label}
                            </div>
                            {t.desc && (
                              <div style={{ fontSize: '11px', color: '#484848', fontFamily: 'Inter, sans-serif' }}>
                                {t.desc}
                              </div>
                            )}
                          </div>
                          {selected && (
                            <span style={{ color: '#c799ff', fontSize: '14px', flexShrink: 0, marginLeft: '12px' }}>✓</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block', fontSize: '9px', letterSpacing: '0.2em',
                    textTransform: 'uppercase', color: '#9f9d9d', fontWeight: '700',
                    marginBottom: '10px', fontFamily: 'Inter, sans-serif',
                  }}>
                    Details <span style={{ color: '#333', textTransform: 'none', letterSpacing: 0, fontSize: '10px' }}>optional</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Describe what happened or what you expected…"
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#0e0e0e',
                      border: '1px solid rgba(72,72,72,0.12)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      color: '#e7e5e5', fontSize: '13px',
                      fontFamily: 'Inter, sans-serif',
                      resize: 'vertical', outline: 'none',
                      lineHeight: '1.6',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(199,153,255,0.25)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(72,72,72,0.12)'}
                  />
                </div>

                {/* Auto context pill */}
                {context && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: '20px',
                    padding: '10px 14px',
                    background: '#0e0e0e',
                    border: '1px solid rgba(72,72,72,0.08)',
                    borderRadius: '8px',
                  }}>
                    <span style={{ fontSize: '10px', color: '#484848', fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
                      Auto-captured:
                    </span>
                    {Object.entries(context).map(([k, v]) => (
                      <span key={k} style={{
                        fontSize: '11px', color: '#9f9d9d',
                        fontFamily: 'Inter, sans-serif',
                      }}>
                        <span style={{ color: '#484848' }}>{k} </span>{v}
                      </span>
                    ))}
                  </div>
                )}

                {/* Error */}
                {status === 'error' && (
                  <p style={{ color: '#ef4444', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px', margin: '0 0 12px' }}>
                    Something went wrong — please try again.
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!type || status === 'submitting'}
                  style={{
                    width: '100%', height: '44px',
                    borderRadius: '9999px',
                    background: type ? '#c799ff' : '#1f2020',
                    color: type ? '#0e0e0e' : '#484848',
                    border: 'none',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: '700', fontSize: '13px',
                    cursor: type ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    opacity: status === 'submitting' ? 0.7 : 1,
                  }}
                  onMouseEnter={e => { if (type) e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={e => { if (type) e.currentTarget.style.opacity = '1' }}
                >
                  {status === 'submitting' ? 'Sending…' : 'Send report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}

function SuccessState({ onClose }) {
  return (
    <div style={{
      padding: '48px 32px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '12px', textAlign: 'center',
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        background: 'rgba(199,153,255,0.1)',
        border: '1px solid rgba(199,153,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', marginBottom: '4px',
      }}>
        ✓
      </div>
      <h3 style={{
        margin: 0, fontSize: '16px', fontWeight: '600',
        color: '#e7e5e5', fontFamily: 'Space Grotesk, sans-serif',
      }}>
        Report sent
      </h3>
      <p style={{
        margin: 0, fontSize: '13px', color: '#9f9d9d',
        fontFamily: 'Inter, sans-serif', lineHeight: '1.5', maxWidth: '280px',
      }}>
        Thanks for taking the time. We'll look into it.
      </p>
      <button
        onClick={onClose}
        style={{
          marginTop: '8px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#484848', fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#9f9d9d'}
        onMouseLeave={e => e.currentTarget.style.color = '#484848'}
      >
        Close
      </button>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSubjects } from '../lib/questions'
import { useIsMobile } from '../lib/hooks'

const SUBJECT_META = {
  'MM12': {
    volume: 'Volume I',
    label: 'Methods 1&2',
    description: 'Foundational calculus, probability, and advanced algebraic structures.',
    accentColor: '#c799ff',
    glowColor: 'rgba(199,153,255,0.05)',
    glowHover: 'rgba(199,153,255,0.09)',
  },
  'MM34': {
    volume: 'Volume II',
    label: 'Methods 3&4',
    description: 'Integrated analysis, transcendental functions, and statistical inference.',
    accentColor: '#c6c6c6',
    glowColor: 'rgba(198,198,198,0.03)',
    glowHover: 'rgba(198,198,198,0.07)',
  },
  'SM12': {
    volume: 'Volume III',
    label: 'Specialist 1&2',
    description: 'Complex numbers, vectors, and formal logic structures.',
    accentColor: '#767575',
    glowColor: 'rgba(118,117,117,0.03)',
    glowHover: 'rgba(118,117,117,0.07)',
  },
  'SM34': {
    volume: 'Volume IV',
    label: 'Specialist 3&4',
    description: 'Differential equations, mechanics, and rigorous proofs.',
    accentColor: '#bc87fe',
    glowColor: 'rgba(188,135,254,0.04)',
    glowHover: 'rgba(188,135,254,0.08)',
  },
}

const TOPIC_COUNTS = { 'MM12': 11, 'MM34': 14, 'SM12': 0, 'SM34': 0 }

export default function TextbookSelect() {
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState([])
  const [hovered, setHovered]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [showUpdate, setShowUpdate] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    fetchSubjects()
      .then(setSubjects)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const features = [
    'A more efficient way to do your SUP.',
    'Content taken directly from the 2026 SUP.',
    'Questions taken directly from textbooks.',
    'Will be updated yearly!',
  ]

  return (
    <div style={{ height: '100vh', background: '#0e0e0e', color: '#e7e5e5', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center',
        padding: isMobile ? '20px 24px' : '20px 56px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, rgba(199,153,255,0.15), rgba(124,58,237,0.25))',
            border: '1px solid rgba(199,153,255,0.2)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'serif', fontSize: 15, fontWeight: 700, color: '#c799ff',
          }}>Σ</div>
          <div style={{ display: 'flex', flexDirection: 'column', height: 32, justifyContent: 'space-between', padding: '2px 0' }}>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 16, fontWeight: 800, color: '#e7e5e5', letterSpacing: '-0.03em', lineHeight: 1 }}>SUPsmasher</span>
            <div style={{ marginLeft: -2 }}>
              <span style={{ background: 'rgba(199,153,255,0.1)', color: '#c799ff', padding: '2px 5px', borderRadius: 4, fontSize: 8, fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>BETA</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '24px 24px 32px' : '0 56px',
        overflow: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 900 }}>

          {/* Hero */}
          <section style={{ marginBottom: 28 }}>
            <span style={{
              display: 'block', marginBottom: 14,
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: '#c799ff',
            }}>
              JMSS mathematics
            </span>
            <h1 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: isMobile ? '36px' : 'clamp(48px, 6vw, 80px)',
              fontWeight: 900, letterSpacing: '-0.04em',
              lineHeight: 1.0, color: '#e7e5e5', margin: 0,
            }}>
              What's your textbook?
            </h1>
          </section>

          {/* Feature pills */}
          {!isMobile && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {features.map((f, i) => (
                <span key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 12px',
                  background: '#131313',
                  border: '1px solid rgba(72,72,72,0.12)',
                  borderRadius: 9999,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12, color: '#9f9d9d',
                  lineHeight: 1,
                }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#c799ff', flexShrink: 0 }} />
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Cards grid */}
          {loading ? (
            <p style={{ color: '#484848', fontSize: 14 }}>Loading…</p>
          ) : error ? (
            <p style={{ color: '#ee7d77', fontSize: 13 }}>{error}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              {subjects.map(subject => {
                const meta    = SUBJECT_META[subject.code] ?? SUBJECT_META['MM34']
                const hasData = Boolean(TOPIC_COUNTS[subject.code])
                const isHov   = hovered === subject.code

                return (
                  <button
                    key={subject.id}
                    disabled={!hasData}
                    onClick={() => hasData && navigate(`/${subject.code}`, { state: { subject } })}
                    onMouseEnter={() => hasData && setHovered(subject.code)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      position: 'relative',
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: isMobile ? '24px' : '28px 32px',
                      background: isHov ? '#1f2020' : '#131313',
                      borderRadius: 16,
                      border: `1px solid ${isHov ? 'rgba(72,72,72,0.25)' : 'rgba(72,72,72,0.1)'}`,
                      cursor: hasData ? 'pointer' : 'default',
                      opacity: hasData ? 1 : 0.35,
                      transition: 'background 0.5s cubic-bezier(0.4,0,0.2,1), border-color 0.5s cubic-bezier(0.4,0,0.2,1), box-shadow 0.5s cubic-bezier(0.4,0,0.2,1)',
                      boxShadow: isHov ? `0 12px 40px rgba(0,0,0,0.4), 0 0 20px ${meta.glowHover}` : 'none',
                      overflow: 'hidden',
                    }}
                  >
                    <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#484848', marginBottom: 20, position: 'relative' }}>
                      {meta.volume}
                    </span>
                    <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: isMobile ? 24 : 30, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#e7e5e5', margin: '0 0 10px', position: 'relative' }}>
                      {meta.label ?? subject.name}
                    </h3>
                    <p style={{ fontSize: 14, color: '#767575', fontWeight: 400, lineHeight: 1.6, margin: 0, maxWidth: isMobile ? '100%' : 260, position: 'relative' }}>
                      {hasData ? meta.description : 'Coming soon.'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 20, position: 'relative' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: isHov ? meta.accentColor : '#1f2020', border: isHov ? 'none' : '1px solid #252626', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.4s cubic-bezier(0.4,0,0.2,1)', flexShrink: 0 }}>
                        <span style={{ fontSize: 16, lineHeight: 1, color: isHov ? '#0e0e0e' : '#767575', transition: 'color 0.4s cubic-bezier(0.4,0,0.2,1)' }}>→</span>
                      </div>
                      <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: isHov ? '#e7e5e5' : '#484848', transition: 'color 0.4s cubic-bezier(0.4,0,0.2,1)' }}>
                        {hasData ? 'Enter Module' : 'Coming soon'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Update popup */}
      {showUpdate && (
        <>
          <div
            onClick={() => setShowUpdate(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
              animation: 'fadeIn 0.2s ease',
            }}
          />
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
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '24px 24px 20px',
                borderBottom: '1px solid rgba(72,72,72,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>✨</span>
                  <h2 style={{
                    margin: 0, fontSize: '15px', fontWeight: '600',
                    color: '#e7e5e5', fontFamily: 'Space Grotesk, sans-serif',
                    letterSpacing: '-0.01em',
                  }}>
                    Update v1.01!
                  </h2>
                </div>
                <button
                  onClick={() => setShowUpdate(false)}
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

              {/* Content */}
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ color: '#c799ff', fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>•</span>
                    <span style={{ fontSize: '13px', color: '#e7e5e5', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                      Removed exercise selector — always start from the first exercise
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ color: '#c799ff', fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>•</span>
                    <span style={{ fontSize: '13px', color: '#e7e5e5', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                      Removed progress bar from session setup
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ color: '#c799ff', fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>•</span>
                    <span style={{ fontSize: '13px', color: '#e7e5e5', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                      Only spacebar advances questions — clicking the screen no longer works
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ color: '#c799ff', fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>•</span>
                    <span style={{ fontSize: '13px', color: '#e7e5e5', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                      Arrow keys now navigate through answers with filter respect
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ color: '#c799ff', fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>•</span>
                    <span style={{ fontSize: '13px', color: '#e7e5e5', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                      Question panel jumps respect your filter (e.g., Every other)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ color: '#c799ff', fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>•</span>
                    <span style={{ fontSize: '13px', color: '#e7e5e5', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                      Sub-part progress dots are now clickable
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ color: '#c799ff', fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>•</span>
                    <span style={{ fontSize: '13px', color: '#e7e5e5', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                      Grey dots expand when selected but stay grey
                    </span>
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={() => setShowUpdate(false)}
                  style={{
                    width: '100%', height: '44px',
                    borderRadius: '9999px',
                    background: '#c799ff',
                    color: '#0e0e0e',
                    border: 'none',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: '700', fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes modalIn {
              from { opacity: 0; transform: translateY(12px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </>
      )}

    </div>
  )
}

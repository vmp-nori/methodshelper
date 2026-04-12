import { useEffect, useState } from 'react'
import { fetchSubjects } from '../lib/questions'

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

const TOPIC_COUNTS = { 'MM12': 11 }

export default function TextbookSelect({ onSelect }) {
  const [subjects, setSubjects] = useState([])
  const [hovered, setHovered]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    fetchSubjects()
      .then(setSubjects)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ height: '100vh', background: '#0e0e0e', color: '#e7e5e5', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        padding: '20px 56px',
        background: 'transparent',
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
          }}>
            Σ
          </div>
          <span style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 16, fontWeight: 800,
            color: '#e7e5e5', letterSpacing: '-0.03em',
          }}>
            SUPsmasher
          </span>
        </div>
      </header>

      {/* Main */}
      <main style={{ padding: '24px 56px 32px', maxWidth: 1300, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: '16vh' }}>

        {/* Hero */}
        <section style={{ marginBottom: 36 }}>
          <span style={{
            display: 'block', marginBottom: 16,
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#c799ff',
          }}>
            JMSS mathematics
          </span>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(48px, 6vw, 80px)',
            fontWeight: 900, letterSpacing: '-0.04em',
            lineHeight: 1.0, color: '#e7e5e5',
            margin: 0,
          }}>
            ayo whats ur textbook fam
          </h1>
        </section>

        {/* Cards grid */}
        {loading ? (
          <p style={{ color: '#484848', fontSize: 14 }}>Loading…</p>
        ) : error ? (
          <p style={{ color: '#ee7d77', fontSize: 13 }}>{error}</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
          }}>
            {subjects.map(subject => {
              const meta    = SUBJECT_META[subject.code] ?? SUBJECT_META['MM34']
              const hasData = Boolean(TOPIC_COUNTS[subject.code])
              const isHov   = hovered === subject.code

              return (
                <button
                  key={subject.id}
                  disabled={!hasData}
                  onClick={() => hasData && onSelect(subject)}
                  onMouseEnter={() => hasData && setHovered(subject.code)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    padding: '28px 32px',
                    background: isHov ? '#1f2020' : '#131313',
                    borderRadius: 16,
                    border: `1px solid ${isHov ? 'rgba(72,72,72,0.25)' : 'rgba(72,72,72,0.1)'}`,
                    cursor: hasData ? 'pointer' : 'default',
                    opacity: hasData ? 1 : 0.35,
                    transition: 'background 0.5s cubic-bezier(0.4,0,0.2,1), border-color 0.5s cubic-bezier(0.4,0,0.2,1), box-shadow 0.5s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: isHov ? '0 0 40px rgba(198,198,198,0.06)' : 'none',
                    overflow: 'hidden',
                  }}
                >
                  {/* Bloom glow */}
                  <div style={{
                    position: 'absolute',
                    right: -96, top: -96,
                    width: 288, height: 288,
                    background: `radial-gradient(circle, ${isHov ? meta.glowHover : meta.glowColor} 0%, transparent 70%)`,
                    borderRadius: '50%',
                    filter: 'blur(60px)',
                    pointerEvents: 'none',
                    transition: 'background 0.7s cubic-bezier(0.4,0,0.2,1)',
                  }} />

                  {/* Volume label */}
                  <span style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.18em',
                    color: '#484848', marginBottom: 20,
                    position: 'relative',
                  }}>
                    {meta.volume}
                  </span>

                  {/* Name */}
                  <h3 style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: 30, fontWeight: 700,
                    letterSpacing: '-0.03em', lineHeight: 1.05,
                    color: '#e7e5e5', margin: '0 0 10px',
                    position: 'relative',
                  }}>
                    {meta.label ?? subject.name}
                  </h3>

                  {/* Description */}
                  <p style={{
                    fontSize: 14, color: '#767575',
                    fontWeight: 400, lineHeight: 1.6,
                    margin: 0, maxWidth: 260,
                    position: 'relative',
                  }}>
                    {hasData ? meta.description : 'Coming soon.'}
                  </p>

                  {/* CTA */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    marginTop: 'auto', paddingTop: 20,
                    position: 'relative',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: isHov ? meta.accentColor : '#1f2020',
                      border: isHov ? 'none' : '1px solid #252626',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.4s cubic-bezier(0.4,0,0.2,1)',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: 16, lineHeight: 1,
                        color: isHov ? '#0e0e0e' : '#767575',
                        transition: 'color 0.4s cubic-bezier(0.4,0,0.2,1)',
                      }}>→</span>
                    </div>
                    <span style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.14em',
                      color: isHov ? '#e7e5e5' : '#484848',
                      transition: 'color 0.4s cubic-bezier(0.4,0,0.2,1)',
                    }}>
                      {hasData ? 'Enter Module' : 'Coming soon'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

    </div>
  )
}

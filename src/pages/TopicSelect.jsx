import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { fetchSubjects, fetchTopics } from '../lib/questions'

export default function TopicSelect() {
  const { subjectCode } = useParams()
  const location        = useLocation()
  const navigate        = useNavigate()

  const [subject, setSubject] = useState(location.state?.subject ?? null)
  const [topics, setTopics]   = useState([])
  const [hovered, setHovered] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const activeItemRef    = useRef(null)
  const scrollTimerRef   = useRef(null)

  // Resolve subject from URL code if not passed via navigation state (e.g. direct URL / refresh)
  useEffect(() => {
    if (subject) return
    fetchSubjects()
      .then(all => {
        const found = all.find(s => s.code === subjectCode)
        if (found) setSubject(found)
        else setError(`Unknown subject: ${subjectCode}`)
      })
      .catch(err => setError(err.message))
  }, [subjectCode, subject])

  // Fetch topics once subject is resolved
  useEffect(() => {
    if (!subject) return
    setLoading(true)
    fetchTopics(subject.id)
      .then(setTopics)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [subject])

  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    if (!activeItemRef.current) return
    scrollTimerRef.current = setTimeout(() => {
      activeItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 260)
    return () => clearTimeout(scrollTimerRef.current)
  }, [hovered])

  function handleSelect(topic) {
    navigate(`/${subjectCode}/${topic.topic_code}`, { state: { subject, topic } })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0e0e0e', position: 'relative' }}>

      {/* Glows */}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(199,153,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0,
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(198,198,198,0.04) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Main content */}
      <main style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        padding: '52px 72px',
        marginRight: 320,
        zIndex: 1,
      }}>

        {/* Top bar — space for the persistent wordmark on the left */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 56 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: '1px solid #1e1e1e', cursor: 'pointer',
              color: '#767575', fontSize: 12, letterSpacing: '0.1em',
              borderRadius: 9999, padding: '8px 18px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e7e5e5'; e.currentTarget.style.borderColor = '#484848' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#767575'; e.currentTarget.style.borderColor = '#1e1e1e' }}
          >
            ← Change textbook
          </button>
        </div>

        {/* Header */}
        <header style={{ marginBottom: 48 }}>
          <span style={{
            color: '#c799ff', fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', display: 'block', marginBottom: 14,
          }}>
            {subject?.code ?? subjectCode}
          </span>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 52, fontWeight: 700,
            color: '#e7e5e5', margin: '0 0 14px',
            letterSpacing: '-0.03em', lineHeight: 1.05,
          }}>
            Topics
          </h1>
          <p style={{
            color: '#acabaa', fontSize: 16, margin: 0,
            maxWidth: 500, lineHeight: 1.7, fontWeight: 300,
          }}>
            Select a topic to begin your session.
          </p>
        </header>

        {/* Topic list */}
        {loading ? (
          <p style={{ color: '#484848', fontSize: 14 }}>Loading…</p>
        ) : error ? (
          <p style={{ color: '#ee7d77', fontSize: 13 }}>{error}</p>
        ) : (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 80 }}>
            {topics.map((topic, i) => {
              const isHov = hovered === topic.topic_code
              const exCount = topic.exercises?.length ?? 0

              return (
                <div
                  key={topic.topic_code}
                  onMouseEnter={() => setHovered(topic.topic_code)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleSelect(topic)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 24px 10px 32px',
                    background: isHov ? '#191a1a' : '#131313',
                    borderRadius: 9999,
                    border: `1px solid ${isHov ? 'rgba(199,153,255,0.08)' : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'background 0.4s cubic-bezier(0.4,0,0.2,1), border-color 0.4s cubic-bezier(0.4,0,0.2,1)',
                    gap: 24,
                  }}
                >
                  {/* Number + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                    <span style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: 13, fontWeight: 700,
                      color: '#767575', opacity: 0.5,
                      minWidth: 28,
                    }}>
                      {String(i).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: 18, fontWeight: 500,
                        color: isHov ? '#c799ff' : '#e7e5e5',
                        margin: 0, letterSpacing: '-0.01em',
                        transition: 'color 0.4s cubic-bezier(0.4,0,0.2,1)',
                      }}>
                        {topic.topic_name}
                      </h3>
                      <p style={{
                        fontSize: 10, letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        color: isHov ? '#c799ff' : '#767575',
                        margin: '3px 0 0',
                        transition: 'color 0.4s cubic-bezier(0.4,0,0.2,1)',
                      }}>
                        {topic.topic_code} · {exCount} {exCount === 1 ? 'exercise' : 'exercises'}
                      </p>
                    </div>
                  </div>

                  {/* Progress + button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 10, color: '#767575', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                        Exercises
                      </span>
                      <div style={{ width: 120, height: 3, background: '#252626', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: exCount > 0 ? '100%' : '0%',
                          background: isHov ? '#c799ff' : '#484848',
                          transition: 'background 0.4s cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </div>
                    </div>

                    <button
                      onClick={e => { e.stopPropagation(); handleSelect(topic) }}
                      style={{
                        padding: isHov ? '10px 28px' : '10px 14px',
                        borderRadius: 9999,
                        background: isHov ? 'linear-gradient(135deg, #c6c6c6, #454747)' : 'transparent',
                        border: isHov ? 'none' : '1px solid rgba(118,117,117,0.25)',
                        color: isHov ? '#0e0e0e' : '#767575',
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontWeight: 700, fontSize: 13,
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
                        whiteSpace: 'nowrap',
                        minWidth: 44, height: 44,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isHov ? 'Start' : '▶'}
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </main>

      {/* Right: Unit Plan panel */}
      <aside style={{
        position: 'fixed', right: 0, top: 0,
        width: 320, height: '100vh',
        background: '#131313',
        borderLeft: '1px solid rgba(72,72,72,0.15)',
        display: 'flex', flexDirection: 'column',
        padding: '40px 28px',
        zIndex: 10,
        overflowY: 'auto',
      }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{
            color: '#c799ff', fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', display: 'block', marginBottom: 8,
          }}>
            Reference
          </span>
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 22, fontWeight: 700,
            color: '#e7e5e5', margin: 0,
          }}>
            Unit Plan
          </h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <p style={{ color: '#484848', fontSize: 13 }}>Loading…</p>
          ) : topics.length === 0 ? (
            <p style={{ color: '#484848', fontSize: 13 }}>No topics found.</p>
          ) : (
            topics.map(topic => {
              const isActive = hovered === topic.topic_code
              return (
                <div
                  key={topic.topic_code}
                  ref={isActive ? activeItemRef : null}
                  onClick={() => handleSelect(topic)}
                  style={{
                    borderLeft: `2px solid ${isActive ? '#c799ff' : 'rgba(72,72,72,0.3)'}`,
                    paddingLeft: 14,
                    paddingTop: isActive ? 8 : 4,
                    paddingBottom: isActive ? 8 : 4,
                    background: isActive ? 'rgba(199,153,255,0.04)' : 'transparent',
                    borderRadius: isActive ? '0 8px 8px 0' : 0,
                    cursor: 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h4 style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: 13, fontWeight: 700,
                      color: isActive ? '#c799ff' : '#e7e5e5',
                      margin: 0, transition: 'color 0.4s cubic-bezier(0.4,0,0.2,1)',
                    }}>
                      {topic.topic_name}
                    </h4>
                    {isActive && (
                      <span style={{
                        fontSize: 8, background: '#c799ff', color: '#000',
                        padding: '2px 6px', borderRadius: 3, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        flexShrink: 0, marginLeft: 8,
                      }}>
                        Active
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: '#484848', margin: 0 }}>
                    {topic.topic_code} · {topic.exercises?.length ?? 0} exercises
                  </p>

                  <div style={{
                    display: 'grid',
                    gridTemplateRows: isActive && topic.exercises?.length > 0 ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.25s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    <div style={{ overflow: 'hidden', minHeight: 0 }}>
                      <p style={{ fontSize: 11, color: '#acabaa', margin: '6px 0 0', lineHeight: 1.6 }}>
                        {topic.exercises?.map((ex, i) => (
                          <span key={i} style={{ display: 'block' }}>
                            Ex {ex.exercise} — {ex.questions.length} questions
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {!loading && !error && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(72,72,72,0.15)' }}>
            <div style={{ background: '#191a1a', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#767575', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Total Exercises
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c799ff' }}>
                  {topics.reduce((s, t) => s + (t.exercises?.length ?? 0), 0)}
                </span>
              </div>
              <div style={{ height: 3, background: '#252626', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', background: '#c799ff', opacity: 0.4 }} />
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

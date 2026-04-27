import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { fetchSubjects, fetchSupData } from '../lib/questions'
import { useIsMobile } from '../lib/hooks'

const SKIP_OPTIONS = [
  { label: 'All questions', desc: 'a, b, c, d…',  skipEvery: 1, skipOffset: 0 },
  { label: 'Every other',   desc: 'a, c, e, g…',  skipEvery: 2, skipOffset: 0 },
  { label: 'Every third',   desc: 'a, d, g, j…',  skipEvery: 3, skipOffset: 0 },
  { label: 'End on last',   desc: 'every other + last', skipEvery: 2, endOnLast: true },
]

export default function Home() {
  const { subjectCode, topicCode } = useParams()
  const location  = useLocation()
  const navigate  = useNavigate()
  const isMobile = useIsMobile()

  const [subject, setSubject]   = useState(location.state?.subject ?? null)
  const [topic, setTopic]       = useState(location.state?.topic   ?? null)
  const [loadError, setLoadError] = useState(null)

  const [skipOption, setSkipOption]     = useState(0)
  const startExercise = 0

  // Resolve subject + topic from URL if not in navigation state (direct URL / refresh)
  useEffect(() => {
    if (subject && topic) return
    fetchSubjects()
      .then(async all => {
        const foundSubject = all.find(s => s.code === subjectCode)
        if (!foundSubject) { setLoadError(`Unknown subject: ${subjectCode}`); return }
        setSubject(foundSubject)
        const foundTopic = await fetchSupData(topicCode, foundSubject.id)
        setTopic(foundTopic)
      })
      .catch(err => setLoadError(err.message))
  }, [subjectCode, topicCode, subject, topic])

  function handleStart() {
    const { label, desc, ...skip } = SKIP_OPTIONS[skipOption]
    const config = { topic, startExerciseIndex: startExercise, subjectId: subject.id, ...skip }
    navigate(`/${subjectCode}/${topicCode}/session`, { state: { config } })
  }

  const currentEx = topic.exercises?.[startExercise]
  const totalQuestions = topic.exercises?.reduce((sum, ex) => sum + ex.questions.length, 0) || 0
  const questionsSkipped = topic.exercises?.slice(0, startExercise).reduce((sum, ex) => sum + ex.questions.length, 0) || 0
  const questionsRemaining = totalQuestions - questionsSkipped
  const progressPct = totalQuestions > 0 ? (questionsSkipped / totalQuestions) * 100 : 0

  if (loadError) return (
    <div style={{ height: '100vh', background: '#0e0e0e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ color: '#ef4444', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{loadError}</p>
      <button onClick={() => navigate('/')} style={{ color: '#484848', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Home</button>
    </div>
  )

  if (!subject || !topic) return (
    <div style={{ height: '100vh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#484848', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ 
      background: '#0e0e0e', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingLeft: isMobile ? '16px' : '24px', 
      paddingRight: isMobile ? '16px' : '24px', 
      overflowY: 'auto' 
    }}>
      {/* Back Link */}
      <div style={{ width: '100%', maxWidth: '700px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9f9d9d', fontSize: '11px', letterSpacing: '0.16em',
            textTransform: 'uppercase', fontWeight: '600',
            fontFamily: 'Inter, sans-serif',
            padding: 0,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#c799ff'}
          onMouseLeave={e => e.currentTarget.style.color = '#9f9d9d'}
        >
          ← {topic.topic_name}
        </button>
      </div>

      {/* Main Card */}
      <section style={{
        width: '100%', maxWidth: '700px',
        background: '#131313',
        borderRadius: '12px',
        padding: isMobile ? '28px 24px' : '36px 32px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 40px rgba(199, 153, 255, 0.06)',
      }}>
        {/* Atmospheric glow */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '200px', height: '200px',
          background: 'rgba(199, 153, 255, 0.05)',
          filter: 'blur(100px)',
          borderRadius: '50%',
        }} />

        {/* Header */}
        <div style={{ marginBottom: isMobile ? '24px' : '32px', position: 'relative', zIndex: 10 }}>
          <h1 style={{ 
            fontSize: isMobile ? '28px' : '36px', 
            fontWeight: '700', 
            color: '#e7e5e5', 
            margin: '0 0 8px 0', 
            letterSpacing: '-0.02em', 
            fontFamily: 'Space Grotesk, sans-serif',
            lineHeight: 1.2
          }}>
            {topic.topic_name}
          </h1>
          <p style={{ color: '#9f9d9d', fontSize: '13px', maxWidth: '400px', margin: 0, fontFamily: 'Inter, sans-serif', lineHeight: '1.4' }}>
            Configure your study parameters for optimal focus.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Question Filter */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9f9d9d', fontWeight: '700', marginBottom: '12px', marginLeft: '2px', fontFamily: 'Inter, sans-serif' }}>
              Question filter
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
              {SKIP_OPTIONS.map((opt, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <input
                    type="radio"
                    id={`f${i}`}
                    name="filter"
                    checked={skipOption === i}
                    onChange={() => setSkipOption(i)}
                    style={{ position: 'absolute', opacity: 0 }}
                  />
                  <label htmlFor={`f${i}`} style={{
                    display: 'flex', flexDirection: 'column', gap: '3px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: skipOption === i ? '#1f2020' : '#131313',
                    border: `1px solid ${skipOption === i ? 'rgba(199, 153, 255, 0.3)' : 'rgba(72, 72, 72, 0.1)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (skipOption !== i) {
                      e.currentTarget.style.borderColor = 'rgba(199, 153, 255, 0.3)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (skipOption !== i) {
                      e.currentTarget.style.borderColor = 'rgba(72, 72, 72, 0.1)'
                    }
                  }}
                  >
                    <span style={{ color: '#e7e5e5', fontSize: '12px', fontWeight: '600', fontFamily: 'Inter, sans-serif' }}>
                      {opt.label}
                    </span>
                    <span style={{ color: '#767575', fontSize: '10px', fontFamily: 'Inter, sans-serif' }}>
                      {opt.desc}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Primary Action */}
          <button
            onClick={handleStart}
            disabled={!topic.exercises?.length}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '9999px',
              background: '#c799ff',
              color: '#0e0e0e',
              border: 'none',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: '700',
              fontSize: '14px',
              cursor: topic.exercises?.length ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '8px',
              opacity: topic.exercises?.length ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              if (topic.exercises?.length) e.currentTarget.style.opacity = '0.85'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = topic.exercises?.length ? '1' : '0.5'
            }}
            onMouseDown={e => {
              if (topic.exercises?.length) e.currentTarget.style.transform = 'scale(0.98)'
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Start session
            <span style={{ fontSize: '16px' }}>▶</span>
          </button>
        </div>
      </section>

      {/* Decorative elements - hidden on small screens */}
      {!isMobile && (
        <div style={{
          position: 'fixed', bottom: '40px', left: '32px',
          opacity: 0.15, pointerEvents: 'none',
          fontSize: '80px', fontWeight: '900', color: '#767575',
          lineHeight: 1, fontFamily: 'Space Grotesk, sans-serif',
        }}>
          ∑
        </div>
      )}
    </div>
  )
}

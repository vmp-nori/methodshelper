import { useState, useRef, useEffect } from 'react'

function ExerciseDropdown({ exercises, selectedIndex, onSelect }) {
  const [open, setOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const currentEx = exercises?.[selectedIndex]
  const questionsCount = currentEx?.questions?.length || 0

  return (
    <div style={{ marginBottom: '28px' }}>
      <label style={{
        display: 'block', fontSize: '9px', letterSpacing: '0.2em',
        textTransform: 'uppercase', color: '#9f9d9d', fontWeight: '700',
        marginBottom: '10px', marginLeft: '2px', fontFamily: 'Inter, sans-serif',
      }}>
        Start from exercise
      </label>

      <div ref={containerRef} style={{ position: 'relative' }}>
        {/* Trigger */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', height: '48px',
            background: '#1f2020',
            border: `1px solid ${open ? 'rgba(199, 153, 255, 0.35)' : 'rgba(72, 72, 72, 0.15)'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingLeft: '16px', paddingRight: '14px',
            transition: 'border-color 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={e => {
            if (!open) e.currentTarget.style.borderColor = 'rgba(199, 153, 255, 0.25)'
          }}
          onMouseLeave={e => {
            if (!open) e.currentTarget.style.borderColor = 'rgba(72, 72, 72, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '15px', color: '#c799ff', lineHeight: 1 }}>📖</span>
            <span style={{ color: '#e7e5e5', fontSize: '13px', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
              Exercise {currentEx?.exercise} — {questionsCount} Q
            </span>
          </div>
          <span style={{
            color: '#9f9d9d',
            fontSize: '14px',
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            lineHeight: 1,
          }}>
            ⌄
          </span>
        </button>

        {/* Dropdown list */}
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#1a1a1a',
          border: '1px solid rgba(199, 153, 255, 0.2)',
          borderRadius: '6px',
          maxHeight: open ? '220px' : '0px',
          overflowY: 'auto',
          overflowX: 'hidden',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'max-height 0.15s ease, opacity 0.15s ease, transform 0.15s ease',
          pointerEvents: open ? 'auto' : 'none',
          zIndex: 100,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}>
          {exercises?.map((ex, i) => {
            const isSelected = i === selectedIndex
            const isHovered = i === hoveredIndex
            return (
              <div
                key={ex.exercise}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => { onSelect(i); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isHovered ? '#1f2020' : 'transparent',
                  transition: 'background 0.1s ease',
                }}
              >
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: '500',
                  color: isSelected ? '#c799ff' : '#e7e5e5',
                }}>
                  Exercise {ex.exercise} — {ex.questions.length} Q
                </span>
                {isSelected && (
                  <span style={{ color: '#c799ff', fontSize: '13px', lineHeight: 1 }}>✓</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const SKIP_OPTIONS = [
  { label: 'All questions', desc: 'a, b, c, d…',  skipEvery: 1, skipOffset: 0 },
  { label: 'Every other',   desc: 'a, c, e, g…',  skipEvery: 2, skipOffset: 0 },
  { label: 'Every third',   desc: 'a, d, g, j…',  skipEvery: 3, skipOffset: 0 },
  { label: 'End on last',   desc: 'every other + last', skipEvery: 2, endOnLast: true },
]

export default function Home({ subject, topic, onStart, onBack }) {
  const [skipOption, setSkipOption] = useState(0)
  const [startExercise, setStartExercise] = useState(0)

  function handleStart() {
    const { label, desc, ...skip } = SKIP_OPTIONS[skipOption]
    onStart({ topic, startExerciseIndex: startExercise, subjectId: subject.id, ...skip })
  }

  const currentEx = topic.exercises?.[startExercise]
  const totalQuestions = topic.exercises?.reduce((sum, ex) => sum + ex.questions.length, 0) || 0
  const questionsSkipped = topic.exercises?.slice(0, startExercise).reduce((sum, ex) => sum + ex.questions.length, 0) || 0
  const questionsRemaining = totalQuestions - questionsSkipped
  const progressPct = totalQuestions > 0 ? (questionsSkipped / totalQuestions) * 100 : 0

  return (
    <div style={{ background: '#0e0e0e', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingLeft: '24px', paddingRight: '24px', overflowY: 'auto' }}>
      {/* Back Link */}
      <div style={{ width: '100%', maxWidth: '700px', marginBottom: '24px' }}>
        <button
          onClick={onBack}
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
        padding: '36px 32px',
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
        <div style={{ marginBottom: '32px', position: 'relative', zIndex: 10 }}>
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#e7e5e5', margin: '0 0 8px 0', letterSpacing: '-0.02em', fontFamily: 'Space Grotesk, sans-serif' }}>
            {topic.topic_name}
          </h1>
          <p style={{ color: '#9f9d9d', fontSize: '13px', maxWidth: '400px', margin: 0, fontFamily: 'Inter, sans-serif', lineHeight: '1.4' }}>
            Configure your study parameters for optimal focus.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Start Exercise Dropdown */}
          <ExerciseDropdown
            exercises={topic.exercises}
            selectedIndex={startExercise}
            onSelect={setStartExercise}
          />

          {/* Question Filter */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9f9d9d', fontWeight: '700', marginBottom: '12px', marginLeft: '2px', fontFamily: 'Inter, sans-serif' }}>
              Question filter
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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

          {/* Progress indicator */}
          <div style={{
            paddingTop: '16px', borderTop: '1px solid rgba(72, 72, 72, 0.05)',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <span style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9f9d9d', fontWeight: '700', fontFamily: 'Inter, sans-serif' }}>
                Starting at
              </span>
              <span style={{ fontSize: '12px', color: '#c799ff', fontWeight: '600', fontFamily: 'Inter, sans-serif' }}>
                {Math.round(100 - progressPct)}%
              </span>
            </div>
            <div style={{ height: '3px', background: '#1f2020', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: '#484848',
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }} />
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
      <div style={{
        position: 'fixed', bottom: '40px', left: '32px',
        opacity: 0.15, pointerEvents: 'none',
        fontSize: '80px', fontWeight: '900', color: '#767575',
        lineHeight: 1, fontFamily: 'Space Grotesk, sans-serif',
        display: 'none'
      }}>
        ∑
      </div>
    </div>
  )
}

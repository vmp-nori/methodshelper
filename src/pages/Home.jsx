import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Sidebar from '../components/Sidebar'

const SKIP_OPTIONS = [
  { label: 'All questions',              skipEvery: 1, skipOffset: 0 },
  { label: 'Every other  (Q1, Q3, Q5…)', skipEvery: 2, skipOffset: 0 },
  { label: 'Every third  (Q1, Q4, Q7…)', skipEvery: 3, skipOffset: 0 },
  { label: 'Even only    (Q2, Q4, Q6…)', skipEvery: 2, skipOffset: 1 },
]

export default function Home({ subject, topic, onStart, onBack }) {
  const [skipOption, setSkipOption]     = useState(0)
  const [startExercise, setStartExercise] = useState(0)

  function handleStart() {
    const skip = SKIP_OPTIONS[skipOption]
    onStart({ topic, startExerciseIndex: startExercise, subjectId: subject.id, ...skip })
  }

  return (
    <div className="flex h-screen" style={{ background: '#0a0a0a' }}>
      <Sidebar activePage="session" />

      <main style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 64px',
      }}>
        {/* Title */}
        <div style={{ width: '100%', maxWidth: 600, marginBottom: 40 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#444', fontSize: 11, letterSpacing: '0.15em',
              textTransform: 'uppercase', marginBottom: 6,
              padding: 0, display: 'flex', alignItems: 'center', gap: 6,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#888'}
            onMouseLeave={e => e.currentTarget.style.color = '#444'}
          >
            ← {topic.topic_name}
          </button>
          <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
            New session
          </h1>
        </div>

        {/* Form */}
        <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Start exercise */}
          {topic.exercises?.length > 0 && (
            <Field label="Start from exercise">
              <select
                value={startExercise}
                onChange={e => setStartExercise(Number(e.target.value))}
                style={{
                  background: '#111', border: '1px solid #1e1e1e', color: '#ccc',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, width: '100%',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                {topic.exercises.map((ex, i) => (
                  <option key={ex.exercise} value={i}>
                    Exercise {ex.exercise} — {ex.questions.length} questions
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Skip pattern */}
          <Field label="Question filter">
            <div className="flex flex-col gap-1">
              {SKIP_OPTIONS.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSkipOption(i)}
                  style={{
                    background: skipOption === i ? '#1a1330' : '#111',
                    border: `1px solid ${skipOption === i ? '#7c3aed55' : '#1e1e1e'}`,
                    color: skipOption === i ? '#a78bfa' : '#666',
                    borderRadius: 8, padding: '10px 14px', textAlign: 'left',
                    cursor: 'pointer', fontSize: 13, transition: 'all 0.1s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Start button */}
          <button
            onClick={handleStart}
            disabled={!topic.exercises?.length}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '14px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: topic.exercises?.length ? 1 : 0.4,
              transition: 'opacity 0.15s',
            }}
          >
            Start session <ChevronRight size={16} />
          </button>
        </div>
      </main>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p style={{
        color: '#444', fontSize: 11, letterSpacing: '0.15em',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

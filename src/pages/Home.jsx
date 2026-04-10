import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { fetchTopics } from '../lib/questions'

const SKIP_OPTIONS = [
  { label: 'All questions',             skipEvery: 1, skipOffset: 0 },
  { label: 'Every other  (Q1, Q3, Q5…)', skipEvery: 2, skipOffset: 0 },
  { label: 'Every third  (Q1, Q4, Q7…)', skipEvery: 3, skipOffset: 0 },
  { label: 'Even only    (Q2, Q4, Q6…)', skipEvery: 2, skipOffset: 1 },
]

export default function Home({ onStart }) {
  const [topics, setTopics]               = useState([])
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [skipOption, setSkipOption]       = useState(0)
  const [startExercise, setStartExercise] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    fetchTopics()
      .then(data => {
        setTopics(data)
        if (data.length > 0) setSelectedTopic(data[0])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleTopicChange(code) {
    const t = topics.find(t => t.topic_code === code)
    setSelectedTopic(t)
    setStartExercise(0)
  }

  function handleStart() {
    if (!selectedTopic) return
    const skip = SKIP_OPTIONS[skipOption]
    onStart({ topic: selectedTopic, startExerciseIndex: startExercise, ...skip })
  }

  return (
    <div className="flex h-screen" style={{ background: '#0a0a0a' }}>
      <Sidebar activePage="session" />

      <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-12 py-10">
        {/* Title */}
        <div className="w-full max-w-xl mb-10">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
            Methods 1 &amp; 2
          </p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 600, margin: 0 }}>
            New session
          </h1>
        </div>

        {/* Form */}
        <div className="w-full max-w-xl flex flex-col gap-6">

          {/* Topic */}
          <Field label="Topic">
            {loading ? (
              <p style={{ color: '#444', fontSize: 14 }}>Loading…</p>
            ) : error ? (
              <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                {topics.map(t => (
                  <button
                    key={t.topic_code}
                    onClick={() => handleTopicChange(t.topic_code)}
                    style={{
                      background: selectedTopic?.topic_code === t.topic_code ? '#1a1330' : '#111',
                      border: `1px solid ${selectedTopic?.topic_code === t.topic_code ? '#7c3aed55' : '#1e1e1e'}`,
                      color: selectedTopic?.topic_code === t.topic_code ? '#a78bfa' : '#888',
                      borderRadius: 8,
                      padding: '10px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      transition: 'all 0.1s',
                      display: 'flex',
                      gap: 12,
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', opacity: 0.6 }}>{t.topic_code}</span>
                    <span>{t.topic_name}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>

          {/* Start exercise */}
          {selectedTopic?.exercises?.length > 0 && (
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
                {selectedTopic.exercises.map((ex, i) => (
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
            disabled={!selectedTopic || (selectedTopic?.exercises?.length === 0)}
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
              opacity: (!selectedTopic || selectedTopic?.exercises?.length === 0) ? 0.4 : 1,
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
        color: '#444', fontSize: 10, letterSpacing: '0.15em',
        textTransform: 'uppercase', marginBottom: 8,
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

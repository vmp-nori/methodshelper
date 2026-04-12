import { useEffect, useState, useCallback, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { MathText } from '../lib/math.jsx'
import { buildQuestionList, fetchQuestionsForSession } from '../lib/questions'

const PHASE = { QUESTION: 'q', ANSWER: 'a' }

// ── Timer hook ──────────────────────────────────────────────────────────────
function useTimer() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function Session({ config, onBack }) {
  const { topic, startExerciseIndex, skipEvery, skipOffset, subjectId } = config

  const [questionList, setQuestionList] = useState([])
  const [questions, setQuestions]       = useState([])
  const [index, setIndex]               = useState(0)
  const [phase, setPhase]               = useState(PHASE.QUESTION)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const timer                           = useTimer()

  // Fade animation key — changes on each new question
  const [fadeKey, setFadeKey] = useState(0)

  useEffect(() => {
    const exFromStart = topic.exercises.slice(startExerciseIndex)
    const list = buildQuestionList(exFromStart, skipEvery, skipOffset)
    setQuestionList(list)
    fetchQuestionsForSession(list, subjectId)
      .then(data => { setQuestions(data); setIndex(0); setPhase(PHASE.QUESTION) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [topic, startExerciseIndex, skipEvery, skipOffset])

  const advance = useCallback(() => {
    if (phase === PHASE.QUESTION) {
      setPhase(PHASE.ANSWER)
    } else if (index + 1 < questions.length) {
      setIndex(i => i + 1)
      setPhase(PHASE.QUESTION)
      setFadeKey(k => k + 1)
    }
  }, [phase, index, questions.length])

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Space')     { e.preventDefault(); advance() }
      else if (e.code === 'Enter') { e.preventDefault(); advance() }
      else if (e.code === 'ArrowRight' && phase === PHASE.ANSWER) {
        e.preventDefault()
        if (index + 1 < questions.length) {
          setIndex(i => i + 1); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1)
        }
      }
      else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        if (index > 0) { setIndex(i => i - 1); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1) }
      }
      else if (e.code === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, index, questions.length, phase, onBack])

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen error={error} onBack={onBack} />
  if (questions.length === 0) return <EmptyScreen onBack={onBack} />

  const current     = questions[index]
  const currentMeta = questionList[index]
  const isDone      = phase === PHASE.ANSWER && index === questions.length - 1

  // Exercise label like "SECTION 1A"  →  "EXERCISE 1A"
  const exerciseLabel = currentMeta?.exercise ?? ''
  const topicName     = topic.topic_name ?? topic.topic_code

  return (
    <div
      className="flex h-screen"
      style={{ background: '#0a0a0a' }}
      onClick={advance}
    >
      <Sidebar activePage="session" />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <header
          style={{ padding: '32px 48px 0' }}
          className="flex items-start justify-between shrink-0"
        >
          <div>
            <p style={{
              color: '#555', fontSize: 11, letterSpacing: '0.15em',
              textTransform: 'uppercase', marginBottom: 6,
            }}>
              Exercise {exerciseLabel} &nbsp;·&nbsp; Q{currentMeta?.number}
              &nbsp;&nbsp;
              <span style={{ color: '#333' }}>
                {index + 1} / {questions.length}
              </span>
            </p>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
              {topicName}
            </h1>
          </div>

          {/* Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#141414', border: '1px solid #1e1e1e',
            borderRadius: 8, padding: '6px 12px',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', display: 'block' }} />
            <span style={{ color: '#ccc', fontSize: 13, fontFamily: 'monospace' }}>{timer}</span>
          </div>
        </header>

        {/* ── Progress bar ── */}
        <div style={{ height: 2, background: '#1a1a1a', margin: '16px 48px 0', borderRadius: 1 }}>
          <div style={{
            height: '100%', background: '#7c3aed', borderRadius: 1,
            width: `${((index + (phase === PHASE.ANSWER ? 1 : 0.5)) / questions.length) * 100}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* ── Main content ── */}
        <main
          key={fadeKey}
          style={{ flex: 1, padding: '40px 48px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          {/* Question card */}
          <div style={{
            background: '#111111',
            border: '1px solid #1e1e1e',
            borderRadius: 16,
            padding: '48px 64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            flex: phase === PHASE.ANSWER ? '0 0 auto' : '1 1 auto',
            transition: 'flex 0.3s ease',
          }}>
            {current?.question_image ? (
              <div className="flex flex-col items-center gap-6">
                <QuestionContent text={current.question_text} />
                <img
                  src={current.question_image}
                  alt="Diagram"
                  style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }}
                />
              </div>
            ) : (
              <QuestionContent text={current?.question_text} />
            )}
          </div>

          {/* Answer card — slides in */}
          {phase === PHASE.ANSWER && (
            <div style={{
              background: '#0e1510',
              border: '1px solid #1a2e1a',
              borderRadius: 16,
              padding: '32px 64px',
              flex: '1 1 auto',
              overflow: 'auto',
              animation: 'fadeSlideUp 0.25s ease',
            }}>
              <p style={{
                color: '#4ade8044',
                fontSize: 10, letterSpacing: '0.15em',
                textTransform: 'uppercase', marginBottom: 16,
              }}>
                Answer
              </p>
              {current?.answer_image ? (
                <div className="flex flex-col gap-4">
                  <AnswerContent text={current.answer_text} />
                  <img src={current.answer_image} alt="Answer diagram"
                    style={{ maxWidth: '100%', borderRadius: 8 }} />
                </div>
              ) : (
                <AnswerContent text={current?.answer_text} />
              )}
            </div>
          )}
        </main>

        {/* ── Bottom command bar ── */}
        <footer style={{
          borderTop: '1px solid #1a1a1a',
          padding: '14px 48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          shrink: 0,
        }}>
          <ShortcutHint kbd="SPACE"  label={phase === PHASE.QUESTION ? 'REVEAL ANSWER' : 'NEXT QUESTION'} active />
          <Sep />
          <ShortcutHint kbd="← →"   label="NAVIGATE" />
          <Sep />
          <ShortcutHint kbd="ESC"   label="HOME" />
        </footer>
      </div>

      {/* Fade-slide animation */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function QuestionContent({ text }) {
  if (!text) return (
    <p style={{ color: '#333', fontStyle: 'italic', fontSize: 14 }}>
      Question not indexed yet.
    </p>
  )
  return (
    <div style={{ textAlign: 'center', maxWidth: 700 }}>
      <MathText
        text={text}
        className=""
        style={{ color: '#fff', fontSize: 22, lineHeight: 1.7 }}
      />
    </div>
  )
}

function AnswerContent({ text }) {
  if (!text) return (
    <p style={{ color: '#333', fontStyle: 'italic', fontSize: 14 }}>
      Answer not indexed yet.
    </p>
  )
  return (
    <MathText
      text={text}
      style={{ color: '#86efac', fontSize: 17, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
    />
  )
}

function ShortcutHint({ kbd, label, active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <kbd style={{
        background: active ? '#1e1e1e' : '#141414',
        border: `1px solid ${active ? '#333' : '#1e1e1e'}`,
        borderRadius: 6, padding: '4px 10px',
        color: active ? '#ccc' : '#333',
        fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
        letterSpacing: '0.05em',
      }}>
        {kbd}
      </kbd>
      <span style={{ color: '#333', fontSize: 11, letterSpacing: '0.1em' }}>{label}</span>
    </div>
  )
}

function Sep() {
  return <span style={{ color: '#1e1e1e', fontSize: 18 }}>+</span>
}

// ── Loading / Error / Empty states ──────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex h-screen" style={{ background: '#0a0a0a' }}>
      <Sidebar activePage="session" />
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: '#333', fontSize: 14 }}>Loading questions…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onBack }) {
  return (
    <div className="flex h-screen" style={{ background: '#0a0a0a' }}>
      <Sidebar activePage="session" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
        <button onClick={onBack} style={{ color: '#555', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Back
        </button>
      </div>
    </div>
  )
}

function EmptyScreen({ onBack }) {
  return (
    <div className="flex h-screen" style={{ background: '#0a0a0a' }}>
      <Sidebar activePage="session" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p style={{ color: '#555', fontSize: 14 }}>No questions found for this selection.</p>
        <p style={{ color: '#333', fontSize: 12 }}>Run the indexing script first to populate the database.</p>
        <button onClick={onBack} style={{ color: '#555', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}>
          ← Back
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { MathText } from '../lib/math.jsx'
import { buildQuestionList, fetchQuestionsForSession } from '../lib/questions'

const PHASE = { QUESTION: 'q', ANSWER: 'a' }

function getParts(question) {
  if (!question?.parts || Object.keys(question.parts).length === 0) return []
  return Object.keys(question.parts).sort().map(k => ({ label: k, ...question.parts[k] }))
}

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
  const { topic, startExerciseIndex, skipEvery, skipOffset, endOnLast = false, subjectId } = config

  const [questionList, setQuestionList] = useState([])
  const [questions, setQuestions]       = useState([])
  const [index, setIndex]               = useState(0)
  const [phase, setPhase]               = useState(PHASE.QUESTION)
  const [subPartIndex, setSubPartIndex] = useState(0)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [fadeKey, setFadeKey]           = useState(0)
  const timer                           = useTimer()

  useEffect(() => {
    const exFromStart = topic.exercises.slice(startExerciseIndex)
    const list = buildQuestionList(exFromStart, skipEvery, skipOffset, endOnLast)
    setQuestionList(list)
    fetchQuestionsForSession(list, subjectId)
      .then(data => { setQuestions(data); setIndex(0); setPhase(PHASE.QUESTION); setSubPartIndex(0) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [topic, startExerciseIndex, skipEvery, skipOffset, endOnLast])

  const advance = useCallback(() => {
    const parts = getParts(questions[index])
    const hasParts = parts.length > 0
    if (phase === PHASE.QUESTION) {
      setPhase(PHASE.ANSWER)
    } else if (hasParts && subPartIndex + 1 < parts.length) {
      setSubPartIndex(i => i + 1)
      setPhase(PHASE.QUESTION)
    } else if (index + 1 < questions.length) {
      setIndex(i => i + 1)
      setSubPartIndex(0)
      setPhase(PHASE.QUESTION)
      setFadeKey(k => k + 1)
    }
  }, [phase, index, subPartIndex, questions])

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault(); advance()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        const parts = getParts(questions[index])
        if (parts.length > 0 && subPartIndex + 1 < parts.length) {
          setSubPartIndex(i => i + 1); setPhase(PHASE.QUESTION)
        } else if (index + 1 < questions.length) {
          setIndex(i => i + 1); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1)
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        const parts = getParts(questions[index])
        if (parts.length > 0 && subPartIndex > 0) {
          setSubPartIndex(i => i - 1); setPhase(PHASE.QUESTION)
        } else if (index > 0) {
          setIndex(i => i - 1); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1)
        }
      } else if (e.code === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, index, subPartIndex, questions, phase, onBack])

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen error={error} onBack={onBack} />
  if (questions.length === 0) return <EmptyScreen onBack={onBack} />

  const current    = questions[index]
  const currentMeta = questionList[index]
  const currentParts = getParts(current)
  const hasParts   = currentParts.length > 0
  const activePart = hasParts ? currentParts[subPartIndex] : null
  const topicName  = topic.topic_name ?? topic.topic_code
  const progressPct = ((index + (phase === PHASE.ANSWER ? 1 : 0.5)) / questions.length) * 100

  return (
    <div
      style={{ display: 'flex', height: '100vh', background: '#0e0e0e', overflow: 'hidden' }}
      onClick={advance}
    >
      <Sidebar activePage="session" />

      {/* ── Main question area ── */}
      <section
        key={fadeKey}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 48px', overflow: 'hidden', position: 'relative' }}
      >
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{
                padding: '4px 12px', background: '#1f2020', borderRadius: 9999,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: '#c799ff',
                fontFamily: 'Space Grotesk, sans-serif',
              }}>
                {topicName}
              </span>
              <span style={{ color: '#484848', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                Exercise {currentMeta?.exercise} &nbsp;·&nbsp; Q{currentMeta?.number}
                {hasParts && activePart && (
                  <span style={{ color: '#c799ff' }}>&nbsp;{activePart.label})</span>
                )}
              </span>
            </div>
          </div>

          {/* Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#131313', border: '1px solid rgba(72,72,72,0.15)',
            borderRadius: 9999, padding: '6px 14px',
          }}
          onClick={e => e.stopPropagation()}
          >
            <span style={{ fontSize: 11, color: '#c799ff' }}>⏱</span>
            <span style={{ color: '#e7e5e5', fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500 }}>{timer}</span>
          </div>
        </header>

        {/* Question content — split into two fixed halves so nothing shifts on reveal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 720, width: '100%', alignSelf: 'center', overflow: 'hidden' }}>

          {/* ── Upper half: question (anchored to bottom of this half) ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 28 }}>

            {/* Number + stem */}
            <div style={{ marginBottom: hasParts || current?.question_text ? 20 : 0 }}>
              {current?.question_text ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <span style={{
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 500,
                    color: '#484848', flexShrink: 0, lineHeight: 1.5,
                  }}>
                    {index + 1}.
                  </span>
                  <MathText
                    text={current.question_text}
                    style={{ color: '#e7e5e5', fontSize: 26, fontWeight: 500, lineHeight: 1.5, fontFamily: 'Space Grotesk, sans-serif' }}
                  />
                </div>
              ) : (
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 500, color: '#484848' }}>
                  {index + 1}.
                </span>
              )}
            </div>

            {/* Sub-part card */}
            {hasParts && activePart && (
              <div style={{
                background: '#171717', borderRadius: 12,
                padding: '24px 28px',
                border: '1px solid rgba(72,72,72,0.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <span style={{
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: 22,
                    color: '#c799ff', fontWeight: 300, flexShrink: 0,
                  }}>
                    {activePart.label})
                  </span>
                  <div style={{ flex: 1 }}>
                    {activePart.text ? (
                      <MathText
                        text={activePart.text}
                        style={{ color: '#e7e5e5', fontSize: 22, lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
                      />
                    ) : (
                      <p style={{ color: '#484848', fontStyle: 'italic', fontSize: 14, margin: 0 }}>Question not indexed yet.</p>
                    )}
                  </div>
                </div>
                {activePart.image && (
                  <img src={activePart.image} alt="Diagram"
                    style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, marginTop: 16 }} />
                )}
              </div>
            )}

            {/* Non-parts diagram */}
            {!hasParts && current?.question_image && (
              <img src={current.question_image} alt="Diagram"
                style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, marginTop: 16 }} />
            )}
          </div>

          {/* Divider line — always present, acts as visual anchor */}
          <div style={{ height: 1, background: 'rgba(72,72,72,0.08)', flexShrink: 0 }} />

          {/* ── Lower half: answer (anchored to top of this half) ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 28 }}>
            {phase === PHASE.ANSWER && (
              <div style={{ animation: 'answerReveal 0.35s cubic-bezier(0.16,1,0.3,1) both', position: 'relative' }}>
                {/* Bloom glow */}
                <div style={{
                  position: 'absolute', inset: -20,
                  background: 'rgba(199, 153, 255, 0.05)',
                  filter: 'blur(50px)',
                  borderRadius: 24,
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'relative',
                  background: '#131313', borderRadius: 12,
                  padding: '20px 28px',
                  border: '1px solid rgba(199, 153, 255, 0.1)',
                  animation: 'borderGlow 0.7s ease 0.15s both',
                }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{
                      fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase',
                      color: 'rgba(199,153,255,0.35)', fontWeight: 700,
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {hasParts ? `answer — ${activePart?.label})` : 'answer'}
                    </span>
                  </div>
                  {hasParts && activePart ? (
                    <>
                      {activePart.answer ? (
                        <MathText
                          text={activePart.answer}
                          style={{ color: '#c799ff', fontSize: 20, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}
                        />
                      ) : (
                        <p style={{ color: '#484848', fontStyle: 'italic', fontSize: 14, margin: 0 }}>Answer not indexed yet.</p>
                      )}
                      {activePart.answer_image && (
                        <img src={activePart.answer_image} alt="Answer diagram"
                          style={{ maxWidth: '100%', borderRadius: 8, marginTop: 16 }} />
                      )}
                    </>
                  ) : (
                    <>
                      {current?.answer_text ? (
                        <MathText
                          text={current.answer_text}
                          style={{ color: '#c799ff', fontSize: 20, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}
                        />
                      ) : (
                        <p style={{ color: '#484848', fontStyle: 'italic', fontSize: 14, margin: 0 }}>Answer not indexed yet.</p>
                      )}
                      {current?.answer_image && (
                        <img src={current.answer_image} alt="Answer diagram"
                          style={{ maxWidth: '100%', borderRadius: 8, marginTop: 16 }} />
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Bottom: sub-part dots + SPACE hint */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 8 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Sub-part progress dots */}
          {hasParts && currentParts.length > 1 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {currentParts.map((p, i) => (
                <div key={p.label} style={{
                  height: 4, width: i === subPartIndex ? 32 : 12, borderRadius: 2,
                  background: i === subPartIndex ? '#c799ff' : '#252626',
                  transition: 'all 0.2s ease',
                }} />
              ))}
            </div>
          )}

          {/* Keyboard hint pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#131313', border: '1px solid rgba(72,72,72,0.2)',
            borderRadius: 9999, padding: '8px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <span style={{
              background: '#c799ff', color: '#0e0e0e',
              padding: '2px 8px', borderRadius: 4,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              fontFamily: 'Space Grotesk, sans-serif',
            }}>
              SPACE
            </span>
            <span style={{ color: '#9f9d9d', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
              {phase === PHASE.QUESTION ? 'Reveal Answer' : 'Next Question'}
            </span>
          </div>
        </div>
      </section>

      {/* ── Right panel ── */}
      <QuestionPanel
        questionList={questionList}
        currentIndex={index}
        phase={phase}
        progressPct={progressPct}
        topicName={topicName}
        onJump={i => { setIndex(i); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1) }}
      />

      <style>{`
        @keyframes answerReveal {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes borderGlow {
          0%   { box-shadow: 0 0 0 0 rgba(199,153,255,0.25); border-color: rgba(199,153,255,0.35); }
          60%  { box-shadow: 0 0 20px 4px rgba(199,153,255,0.08); border-color: rgba(199,153,255,0.2); }
          100% { box-shadow: 0 0 0 0 rgba(199,153,255,0); border-color: rgba(199,153,255,0.1); }
        }
      `}</style>
    </div>
  )
}

// ── Question panel ───────────────────────────────────────────────────────────

function QuestionPanel({ questionList, currentIndex, phase, progressPct, topicName, onJump }) {
  const groups = []
  for (const q of questionList) {
    const last = groups[groups.length - 1]
    if (last && last.exercise === q.exercise) {
      last.questions.push(q)
    } else {
      groups.push({ exercise: q.exercise, questions: [q] })
    }
  }

  let flatIdx = 0
  const indexed = groups.map(g => ({
    ...g,
    questions: g.questions.map(q => ({ ...q, flatIndex: flatIdx++ })),
  }))

  return (
    <aside
      style={{
        width: 280, flexShrink: 0,
        background: '#131313',
        borderLeft: '1px solid rgba(72,72,72,0.08)',
        display: 'flex', flexDirection: 'column',
        padding: '40px 24px',
        overflowY: 'auto',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Panel header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#c799ff', lineHeight: 1 }}>▦</span>
          <h2 style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#e7e5e5', margin: 0,
            fontFamily: 'Space Grotesk, sans-serif',
          }}>
            Question Set
          </h2>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#1f2020', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: '#c799ff', borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: '#484848', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            {topicName}
          </span>
          <span style={{ fontSize: 9, color: '#484848', fontFamily: 'Inter, sans-serif' }}>
            {currentIndex + 1} / {questionList.length}
          </span>
        </div>
      </div>

      {/* Question groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
        {indexed.map(group => {
          const groupHasCurrent = group.questions.some(q => q.flatIndex === currentIndex)
          return (
            <div key={group.exercise}>
              <p style={{
                fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: groupHasCurrent ? '#c799ff' : '#484848',
                marginBottom: 8, fontWeight: 700,
                fontFamily: 'Space Grotesk, sans-serif',
              }}>
                Exercise {group.exercise}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {group.questions.map(q => {
                  const isCurrent = q.flatIndex === currentIndex
                  const isDone = q.flatIndex < currentIndex || (q.flatIndex === currentIndex && phase === PHASE.ANSWER)
                  return (
                    <button
                      key={q.number}
                      onClick={() => onJump(q.flatIndex)}
                      title={`Q${q.number}`}
                      style={{
                        width: 30, height: 30, borderRadius: 6,
                        border: isCurrent ? '1px solid rgba(199,153,255,0.5)' : '1px solid transparent',
                        background: isCurrent ? 'rgba(199,153,255,0.1)' : isDone ? '#1f2020' : 'transparent',
                        color: isCurrent ? '#c799ff' : isDone ? '#484848' : '#333',
                        fontSize: 10, fontWeight: isCurrent ? 700 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.color = '#9f9d9d' }}
                      onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.color = isDone ? '#484848' : '#333' }}
                    >
                      {q.number}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ESC hint */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(72,72,72,0.08)' }}>
        <button
          onClick={e => { e.stopPropagation(); /* onBack called via ESC */ }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'none',
            border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <kbd style={{
            background: '#1f2020', border: '1px solid rgba(72,72,72,0.2)',
            borderRadius: 4, padding: '3px 8px',
            color: '#484848', fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
          }}>ESC</kbd>
          <span style={{ color: '#484848', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            Exit
          </span>
        </button>
      </div>
    </aside>
  )
}

// ── Loading / Error / Empty ──────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0e0e0e' }}>
      <Sidebar activePage="session" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#484848', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>Loading questions…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onBack }) {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0e0e0e' }}>
      <Sidebar activePage="session" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ color: '#ef4444', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{error}</p>
        <button onClick={onBack} style={{ color: '#484848', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ← Back
        </button>
      </div>
    </div>
  )
}

function EmptyScreen({ onBack }) {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0e0e0e' }}>
      <Sidebar activePage="session" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <p style={{ color: '#484848', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>No questions found for this selection.</p>
        <p style={{ color: '#333', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>Run the indexing script to populate the database.</p>
        <button onClick={onBack} style={{ color: '#484848', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, fontFamily: 'Inter, sans-serif' }}>
          ← Back
        </button>
      </div>
    </div>
  )
}

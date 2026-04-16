import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MathText } from '../lib/math.jsx'
import { buildQuestionList, fetchQuestionsForSession } from '../lib/questions'
import { useIsMobile } from '../lib/hooks'
import GeminiChat from '../components/GeminiChat'

const PHASE = { QUESTION: 'q', ANSWER: 'a' }

function getAllParts(question) {
  if (!question?.parts || Object.keys(question.parts).length === 0) return []
  return Object.keys(question.parts).sort().map(k => ({ label: k, ...question.parts[k] }))
}

function shouldIncludePart(partIndex, totalParts, skipEvery = 1, skipOffset = 0, endOnLast = false) {
  if (skipEvery === 1) return true

  if (endOnLast && skipEvery > 1) {
    const lastIndex = totalParts - 1
    const offset = lastIndex % skipEvery
    return partIndex % skipEvery === offset
  } else {
    return (partIndex - skipOffset) % skipEvery === 0
  }
}

function getParts(question, skipEvery = 1, skipOffset = 0, endOnLast = false) {
  const allParts = getAllParts(question)

  if (skipEvery === 1) return allParts

  // Apply skip pattern to parts (a, b, c, d, e...)
  return allParts.filter((_, i) => shouldIncludePart(i, allParts.length, skipEvery, skipOffset, endOnLast))
}


export default function Session({ onReport }) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const config    = location.state?.config

  // If arrived without session config (e.g. direct URL), go back to config page
  if (!config) {
    return (
      <div style={{ height: '100vh', background: '#0e0e0e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ color: '#484848', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>No session in progress.</p>
        <button onClick={() => navigate(-1)} style={{ color: '#484848', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Go back</button>
      </div>
    )
  }

  return <SessionInner config={config} onReport={onReport} navigate={navigate} />
}

function AskGeminiButton({ onClick, isMobile }) {
  return (
    <button 
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: '#131313', border: '1px solid rgba(199,153,255,0.2)',
        borderRadius: 9999, padding: '4px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        flexShrink: 0
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(199,153,255,0.4)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(199,153,255,0.2)'}
    >
      <span style={{ fontSize: 12 }}>✨</span>
      <span style={{ 
        color: '#c799ff', 
        fontSize: 10, 
        fontWeight: 700, 
        fontFamily: 'Space Grotesk, sans-serif',
        letterSpacing: '0.02em'
      }}>
        ASK GEMINI
      </span>
    </button>
  )
}

function SessionInner({ config, onReport, navigate }) {
  const { topic, startExerciseIndex, skipEvery, skipOffset, endOnLast = false, subjectId } = config

  const [questionList, setQuestionList] = useState([])
  const [questions, setQuestions]       = useState([])
  const [index, setIndex]               = useState(0)
  const [phase, setPhase]               = useState(PHASE.QUESTION)
  const [subPartIndex, setSubPartIndex] = useState(0)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [fadeKey, setFadeKey]           = useState(0)
  const [panelOpen, setPanelOpen]       = useState(false)
  const [geminiOpen, setGeminiOpen]     = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    const exFromStart = topic.exercises.slice(startExerciseIndex)
    const list = buildQuestionList(exFromStart)
    setQuestionList(list)
    fetchQuestionsForSession(list, subjectId)
      .then(data => {
        setQuestions(data)
        setIndex(0)
        setPhase(PHASE.QUESTION)
        // Find first part that matches filter for initial display
        const firstQ = data[0]
        if (firstQ) {
          const allParts = getAllParts(firstQ)
          let firstMatchingPart = 0
          for (let i = 0; i < allParts.length; i++) {
            if (shouldIncludePart(i, allParts.length, skipEvery, skipOffset, endOnLast)) {
              firstMatchingPart = i
              break
            }
          }
          setSubPartIndex(firstMatchingPart)
        } else {
          setSubPartIndex(0)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [topic, startExerciseIndex, skipEvery, skipOffset, endOnLast])

  const advance = useCallback(() => {
    const allParts = getAllParts(questions[index])
    const hasParts = allParts.length > 0

    if (phase === PHASE.QUESTION) {
      setPhase(PHASE.ANSWER)
    } else if (hasParts) {
      // Find next part that matches the filter
      let nextPartIndex = -1
      for (let i = subPartIndex + 1; i < allParts.length; i++) {
        if (shouldIncludePart(i, allParts.length, skipEvery, skipOffset, endOnLast)) {
          nextPartIndex = i
          break
        }
      }

      if (nextPartIndex !== -1) {
        setSubPartIndex(nextPartIndex)
        setPhase(PHASE.QUESTION)
        setGeminiOpen(false)
      } else if (index + 1 < questions.length) {
        // No more parts match filter, move to next question
        const nextQuestion = questions[index + 1]
        const nextAllParts = getAllParts(nextQuestion)
        let firstMatchingPart = 0
        for (let i = 0; i < nextAllParts.length; i++) {
          if (shouldIncludePart(i, nextAllParts.length, skipEvery, skipOffset, endOnLast)) {
            firstMatchingPart = i
            break
          }
        }
        setIndex(i => i + 1)
        setSubPartIndex(firstMatchingPart)
        setPhase(PHASE.QUESTION)
        setFadeKey(k => k + 1)
        setGeminiOpen(false)
      }
    } else if (index + 1 < questions.length) {
      const nextQuestion = questions[index + 1]
      const nextAllParts = getAllParts(nextQuestion)
      let firstMatchingPart = 0
      for (let i = 0; i < nextAllParts.length; i++) {
        if (shouldIncludePart(i, nextAllParts.length, skipEvery, skipOffset, endOnLast)) {
          firstMatchingPart = i
          break
        }
      }
      setIndex(i => i + 1)
      setSubPartIndex(firstMatchingPart)
      setPhase(PHASE.QUESTION)
      setFadeKey(k => k + 1)
      setGeminiOpen(false)
    }
  }, [phase, index, subPartIndex, questions, skipEvery, skipOffset, endOnLast])

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault(); advance()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        const allParts = getAllParts(questions[index])
        if (allParts.length > 0 && subPartIndex + 1 < allParts.length) {
          setSubPartIndex(i => i + 1); setPhase(PHASE.QUESTION); setGeminiOpen(false)
        } else if (index + 1 < questions.length) {
          setIndex(i => i + 1); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1); setGeminiOpen(false)
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        const allParts = getAllParts(questions[index])
        if (allParts.length > 0 && subPartIndex > 0) {
          setSubPartIndex(i => i - 1); setPhase(PHASE.QUESTION); setGeminiOpen(false)
        } else if (index > 0) {
          setIndex(i => i - 1); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1); setGeminiOpen(false)
        }
      }
 else if (e.code === 'ArrowDown') {
        e.preventDefault()
        const currentEx = questionList[index]?.exercise
        let nextIdx = -1
        for (let i = index + 1; i < questionList.length; i++) {
          if (questionList[i].exercise !== currentEx) {
            nextIdx = i; break
          }
        }
        if (nextIdx !== -1) {
          setIndex(nextIdx); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1); setGeminiOpen(false)
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        const currentEx = questionList[index]?.exercise
        let firstOfCurrent = index
        for (let i = index; i >= 0; i--) {
          if (questionList[i].exercise === currentEx) firstOfCurrent = i
          else break
        }

        if (index > firstOfCurrent) {
          setIndex(firstOfCurrent); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1); setGeminiOpen(false)
        } else {
          let prevIdx = -1
          for (let i = index - 1; i >= 0; i--) {
            if (questionList[i].exercise !== currentEx) {
              const prevExLabel = questionList[i].exercise
              for (let j = i; j >= 0; j--) {
                if (questionList[j].exercise === prevExLabel) prevIdx = j
                else break
              }
              break
            }
          }
          if (prevIdx !== -1) {
            setIndex(prevIdx); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1); setGeminiOpen(false)
          }
        }
      } else if (e.code === 'Escape') navigate(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, index, subPartIndex, questions, phase, navigate, questionList, skipEvery, skipOffset, endOnLast])

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen error={error} onBack={() => navigate(-1)} />
  if (questions.length === 0) return <EmptyScreen onBack={() => navigate(-1)} />

  const current    = questions[index]
  const currentMeta = questionList[index]
  const allParts = getAllParts(current)
  const currentParts = getParts(current, skipEvery, skipOffset, endOnLast)
  const hasParts   = allParts.length > 0
  const activePart = hasParts ? allParts[subPartIndex] : null
  const isActivePartIncluded = hasParts && shouldIncludePart(subPartIndex, allParts.length, skipEvery, skipOffset, endOnLast)
  const topicName  = topic.topic_name ?? topic.topic_code
  const progressPct = ((index + (phase === PHASE.ANSWER ? 1 : 0.5)) / questions.length) * 100

  return (
    <div
      style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', background: '#0e0e0e', overflow: 'hidden' }}
      onClick={geminiOpen ? undefined : advance}
    >
      {/* ── Main question area ── */}
      <section
        key={fadeKey}
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          padding: isMobile ? '72px 20px 20px 20px' : '40px 56px',
          overflow: 'hidden', 
          position: 'relative' 
        }}
      >
        {/* Header */}
        <header style={{ display: isMobile ? 'flex' : 'none', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', marginTop: '12px', flexShrink: 0 }}>

          {/* Mobile: panel toggle on left */}
          {isMobile && (
            <button style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, flexShrink: 0,
              background: '#131313', border: '1px solid rgba(72,72,72,0.15)',
              borderRadius: 8, color: '#c799ff', fontSize: 14,
            }}
            onClick={e => { e.stopPropagation(); setPanelOpen(true) }}
            >
              ▦
            </button>
          )}

          {/* Mobile: details on right */}
          {isMobile && (
            <div style={{ textAlign: 'right' }}>
              <p style={{
                margin: '0 0 4px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: '#c799ff',
                fontFamily: 'Space Grotesk, sans-serif',
              }}>
                {topicName}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#e7e5e5', lineHeight: 1 }}>
                  Ex {currentMeta?.exercise}
                </span>
                <span style={{ color: '#484848', fontSize: 14, fontFamily: 'Space Grotesk, sans-serif' }}>·</span>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#e7e5e5', lineHeight: 1 }}>
                  Q{currentMeta?.number}
                  {hasParts && activePart && <span style={{ color: '#c799ff' }}> {activePart.label})</span>}
                </span>
              </div>
            </div>
          )}
        </header>

        {/* Question content — split into two fixed halves so nothing shifts on reveal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1200, width: '100%', alignSelf: 'center', overflowY: geminiOpen ? 'auto' : 'hidden' }}>

          {/* ── Upper half: question (anchored to bottom of this half) ── */}
          <div style={{ flex: geminiOpen ? '0 0 auto' : 1, display: 'flex', flexDirection: 'column', paddingBottom: isMobile ? 20 : 28, paddingTop: isMobile ? 0 : 40 }}>

            {/* Desktop-only breadcrumb moved from header */}
            {!isMobile && (
              <div style={{ marginBottom: 20, flexShrink: 0 }}>
                <p style={{
                  margin: '0 0 6px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
                  textTransform: 'uppercase', color: '#c799ff',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}>
                  {topicName}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#e7e5e5', lineHeight: 1 }}>
                    Ex {currentMeta?.exercise}
                  </span>
                  <span style={{ color: '#484848', fontSize: 18, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500 }}>·</span>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#e7e5e5', lineHeight: 1 }}>
                    Q{currentMeta?.number}
                    {hasParts && activePart && <span style={{ color: '#c799ff' }}> {activePart.label})</span>}
                  </span>
                </div>
              </div>
            )}

            {/* Spacer — grows to push content to bottom (hidden in working-out mode) */}
            {!geminiOpen && <div style={{ flex: 1 }} />}

            {/* Number + stem — positioned directly above sub-part card */}
            <div style={{ marginBottom: isMobile ? 12 : 16, marginTop: 0, flexShrink: 0 }}>
              {current?.question_text ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 12 : 16 }}>
                  <span style={{
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: isMobile ? 20 : 26, fontWeight: 500,
                    color: '#484848', flexShrink: 0, lineHeight: 1.5,
                  }}>
                    {currentMeta?.number}.
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <MathText
                        text={current.question_text}
                        style={{ color: '#e7e5e5', fontSize: isMobile ? 20 : 26, fontWeight: 500, lineHeight: 1.5, fontFamily: 'Space Grotesk, sans-serif' }}
                      />
                      {!hasParts && !geminiOpen && (
                        <div style={{ marginTop: 8 }}>
                          <AskGeminiButton onClick={() => setGeminiOpen(true)} isMobile={isMobile} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: isMobile ? 20 : 26, fontWeight: 500, color: '#484848' }}>
                  {index + 1}.
                </span>
              )}
            </div>

            {/* Fixed sub-part card — label pinned, content expands downward only */}
            {hasParts && activePart && (
              <div style={{
                background: '#171717', borderRadius: 12,
                padding: isMobile ? '16px 20px' : '20px 24px',
                border: '1px solid rgba(72,72,72,0.12)',
                flexShrink: 0,
                marginTop: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <span style={{
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: isMobile ? 18 : 22,
                    color: '#c799ff', fontWeight: 300, flexShrink: 0, lineHeight: 1, height: isMobile ? 26 : 32,
                  }}>
                    {activePart.label})
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        {activePart.text ? (
                          <MathText
                            text={activePart.text}
                            style={{ color: '#e7e5e5', fontSize: isMobile ? 18 : 22, lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
                          />
                        ) : (
                          <p style={{ color: '#484848', fontStyle: 'italic', fontSize: 13, margin: 0 }}>Question not indexed yet.</p>
                        )}
                      </div>
                      {!geminiOpen && (
                        <div style={{ marginTop: 4 }}>
                          <AskGeminiButton onClick={() => setGeminiOpen(true)} isMobile={isMobile} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {activePart.image && (
                  <img src={activePart.image} alt="Diagram"
                    style={{ maxWidth: '100%', maxHeight: isMobile ? 180 : 220, borderRadius: 8, marginTop: 16 }} />
                )}
              </div>
            )}

            {/* Non-parts diagram */}
            {!hasParts && current?.question_image && (
              <img src={current.question_image} alt="Diagram"
                style={{ maxWidth: '100%', maxHeight: isMobile ? 180 : 220, borderRadius: 8, marginTop: 16, flexShrink: 0 }} />
            )}
          </div>

          {/* Inline working out — shown in place of the lower half */}
          {geminiOpen && (
            <GeminiChat
              isOpen={geminiOpen}
              questionText={current?.question_text}
              partLabel={activePart?.label}
              partText={activePart?.text}
            />
          )}

          {/* Divider line — hidden in working-out mode */}
          {!geminiOpen && <div style={{ height: 1, background: 'rgba(72,72,72,0.08)', flexShrink: 0 }} />}

          {/* ── Lower half: answer (anchored to top of this half, hidden in working-out mode) ── */}
          {!geminiOpen && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: isMobile ? 20 : 28 }}>
            {phase === PHASE.ANSWER && (
              <div style={{ animation: 'answerReveal 0.35s cubic-bezier(0.16,1,0.3,1) both', position: 'relative' }}>
                <div style={{
                  position: 'relative',
                  background: '#131313', borderRadius: 12,
                  padding: isMobile ? '16px 20px' : '20px 28px',
                  border: '1px solid rgba(199, 153, 255, 0.15)',
                  animation: 'borderGlow 0.8s ease 0.1s both',
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
                          style={{ color: '#c799ff', fontSize: isMobile ? 18 : 20, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}
                        />
                      ) : (
                        <p style={{ color: '#484848', fontStyle: 'italic', fontSize: 13, margin: 0 }}>Answer not indexed yet.</p>
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
                          style={{ color: '#c799ff', fontSize: isMobile ? 18 : 20, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}
                        />
                      ) : (
                        <p style={{ color: '#484848', fontStyle: 'italic', fontSize: 13, margin: 0 }}>Answer not indexed yet.</p>
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
          </div>}

        </div>

        {/* Bottom: sub-part dots + SPACE hint */}
        <div style={{ 
          flexShrink: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 12, 
          paddingBottom: `calc(${isMobile ? '12px' : '8px'} + env(safe-area-inset-bottom))` 
        }}
          onClick={e => e.stopPropagation()}
        >
          {/* Sub-part progress dots — show all parts with prominent highlighting for active ones */}
          {hasParts && (
            <div style={{ display: 'flex', gap: 10, height: 8 }}>
              {allParts.map((p, i) => {
                const isActive = shouldIncludePart(i, allParts.length, skipEvery, skipOffset, endOnLast)
                const isCurrent = i === subPartIndex
                return (
                  <div key={p.label} style={{
                    height: isCurrent ? 8 : (isActive ? 6 : 4),
                    width: isCurrent ? 40 : (isActive ? 24 : 10),
                    borderRadius: 3,
                    background: isCurrent ? '#c799ff' : (isActive ? 'rgba(199,153,255,0.6)' : '#252626'),
                    transition: 'all 0.2s ease',
                    opacity: isCurrent ? 1 : (isActive ? 1 : 0.5),
                  }} />
                )
              })}
            </div>
          )}

          {/* Keyboard hint pill / Next button */}
          <div 
            onClick={advance}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#131313', border: '1px solid rgba(72,72,72,0.2)',
              borderRadius: 9999, padding: isMobile ? '6px 14px' : '8px 20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              cursor: 'pointer'
            }}
          >
            <span style={{
              background: '#c799ff', color: '#0e0e0e',
              padding: '2px 8px', borderRadius: 4,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              fontFamily: 'Space Grotesk, sans-serif',
            }}>
              {isMobile ? 'NEXT' : 'SPACE'}
            </span>
            <span style={{ color: '#9f9d9d', fontSize: isMobile ? 10 : 12, fontFamily: 'Inter, sans-serif' }}>
              {phase === PHASE.QUESTION ? 'Reveal Answer' : 'Next Question'}
            </span>
          </div>
        </div>
      </section>

      {/* ── Right panel / Bottom drawer ── */}
      {(!isMobile || panelOpen) && (
        <>
          {isMobile && (
            <div 
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 990,
                backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease'
              }}
              onClick={() => setPanelOpen(false)}
            />
          )}
          <QuestionPanel
            isMobile={isMobile}
            questionList={questionList}
            currentIndex={index}
            phase={phase}
            progressPct={progressPct}
            topicName={topicName}
            onJump={i => { 
              setIndex(i); setSubPartIndex(0); setPhase(PHASE.QUESTION); setFadeKey(k => k + 1);
              setGeminiOpen(false);
              if (isMobile) setPanelOpen(false);
            }}
            onClose={() => setPanelOpen(false)}
          />
        </>
      )}

      <style>{`
        @keyframes answerReveal {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes borderGlow {
          0%   { border-color: rgba(199,153,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          50%  { border-color: rgba(199,153,255,0.4); box-shadow: 0 12px 30px rgba(0,0,0,0.4), 0 0 20px rgba(199,153,255,0.12); }
          100% { border-color: rgba(199,153,255,0.25); box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 12px rgba(199,153,255,0.06); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Question panel ───────────────────────────────────────────────────────────

function QuestionPanel({ isMobile, questionList, currentIndex, phase, progressPct, topicName, onJump, onClose }) {
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
        width: isMobile ? '100%' : 280, 
        height: isMobile ? '70vh' : 'auto',
        position: isMobile ? 'fixed' : 'relative',
        bottom: isMobile ? 0 : 'auto',
        left: isMobile ? 0 : 'auto',
        zIndex: isMobile ? 1000 : 1,
        flexShrink: 0,
        background: '#131313',
        borderLeft: isMobile ? 'none' : '1px solid rgba(72,72,72,0.08)',
        borderTop: isMobile ? '1px solid rgba(72,72,72,0.15)' : 'none',
        borderRadius: isMobile ? '20px 20px 0 0' : 0,
        display: 'flex', flexDirection: 'column',
        padding: isMobile ? '24px' : '40px 24px',
        overflowY: 'auto',
        animation: isMobile ? 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        boxShadow: isMobile ? '0 -8px 40px rgba(0,0,0,0.5)' : 'none',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Drawer handle for mobile */}
      {isMobile && (
        <div 
          onClick={onClose}
          style={{ width: 40, height: 4, background: '#252626', borderRadius: 2, margin: '0 auto 24px', flexShrink: 0 }} 
        />
      )}

      {/* Panel header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#c799ff', lineHeight: 1 }}>▦</span>
            <h2 style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: '#e7e5e5', margin: 0,
              fontFamily: 'Space Grotesk, sans-serif',
            }}>
              Question Set
            </h2>
          </div>
          {isMobile && (
            <button 
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#484848', fontSize: 18, padding: 0, cursor: 'pointer' }}
            >
              ×
            </button>
          )}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, overflowY: 'auto' }}>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 4 }}>
                {group.questions.map(q => {
                  const isCurrent = q.flatIndex === currentIndex
                  const isDone = q.flatIndex < currentIndex || (q.flatIndex === currentIndex && phase === PHASE.ANSWER)
                  return (
                    <button
                      key={q.number}
                      onClick={() => onJump(q.flatIndex)}
                      title={`Q${q.number}`}
                      style={{
                        width: isMobile ? 36 : 30, height: isMobile ? 36 : 30, borderRadius: 6,
                        border: isCurrent ? '1px solid rgba(199,153,255,0.5)' : '1px solid transparent',
                        background: isCurrent ? 'rgba(199,153,255,0.1)' : isDone ? '#1f2020' : 'transparent',
                        color: isCurrent ? '#c799ff' : isDone ? '#484848' : '#333',
                        fontSize: isMobile ? 12 : 10, fontWeight: isCurrent ? 700 : 400,
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
      {!isMobile && (
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
      )}
    </aside>
  )
}

// ── Loading / Error / Empty ──────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ height: '100vh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#484848', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>Loading questions…</p>
    </div>
  )
}

function ErrorScreen({ error, onBack }) {
  return (
    <div style={{ height: '100vh', background: '#0e0e0e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ color: '#ef4444', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{error}</p>
      <button onClick={onBack} style={{ color: '#484848', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
        ← Back
      </button>
    </div>
  )
}

function EmptyScreen({ onBack }) {
  return (
    <div style={{ height: '100vh', background: '#0e0e0e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <p style={{ color: '#484848', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>No questions found for this selection.</p>
      <p style={{ color: '#333', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>Run the indexing script to populate the database.</p>
      <button onClick={onBack} style={{ color: '#484848', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, fontFamily: 'Inter, sans-serif' }}>
        ← Back
      </button>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { buildQuestionList, fetchQuestionsForSession } from '../lib/questions'

const PHASE = {
  QUESTION: 'question',
  ANSWER: 'answer',
}

export default function Session({ config, onBack }) {
  const { topic, startExerciseIndex, skipEvery, skipOffset } = config

  const [questionList, setQuestionList] = useState([])
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState(PHASE.QUESTION)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Build question list and fetch all question data
  useEffect(() => {
    const exercisesFromStart = topic.exercises.slice(startExerciseIndex)
    const list = buildQuestionList(exercisesFromStart, skipEvery, skipOffset)
    setQuestionList(list)

    fetchQuestionsForSession(list)
      .then(data => {
        setQuestions(data)
        setIndex(0)
        setPhase(PHASE.QUESTION)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [topic, startExerciseIndex, skipEvery, skipOffset])

  const advance = useCallback(() => {
    if (phase === PHASE.QUESTION) {
      setPhase(PHASE.ANSWER)
    } else {
      if (index + 1 < questions.length) {
        setIndex(i => i + 1)
        setPhase(PHASE.QUESTION)
      }
    }
  }, [phase, index, questions.length])

  // Keyboard handler: Space to advance, Left/Right arrows to navigate, Escape to go back
  useEffect(() => {
    function handleKey(e) {
      if (e.code === 'Space') {
        e.preventDefault()
        advance()
      } else if (e.code === 'ArrowRight' && phase === PHASE.ANSWER) {
        e.preventDefault()
        if (index + 1 < questions.length) {
          setIndex(i => i + 1)
          setPhase(PHASE.QUESTION)
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        if (index > 0) {
          setIndex(i => i - 1)
          setPhase(PHASE.QUESTION)
        }
      } else if (e.code === 'Escape') {
        onBack()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [advance, index, questions.length, phase, onBack])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-400">
        Loading questions…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white gap-4">
        <p className="text-red-400">Error loading questions: {error}</p>
        <button onClick={onBack} className="text-sm text-gray-500 underline">← Back</button>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white gap-4">
        <p className="text-gray-300 text-lg">No questions found for this selection.</p>
        <p className="text-gray-600 text-sm">
          The textbook may not be indexed yet for this topic.
        </p>
        <button onClick={onBack} className="text-sm text-gray-500 underline mt-2">← Back</button>
      </div>
    )
  }

  const isDone = phase === PHASE.ANSWER && index === questions.length - 1
  const current = questions[index]
  const currentMeta = questionList[index]

  return (
    <div
      className="min-h-screen bg-gray-950 text-white flex flex-col select-none"
      onClick={advance}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button
          onClick={e => { e.stopPropagation(); onBack() }}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back
        </button>
        <div className="text-sm text-gray-500">
          {topic.topic_code} — {topic.topic_name}
        </div>
        <div className="text-sm text-gray-400 font-mono">
          {index + 1} / {questions.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((index + (phase === PHASE.ANSWER ? 1 : 0.5)) / questions.length) * 100}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-3xl mx-auto w-full">
        {/* Exercise + question label */}
        <div className="flex items-center gap-3 mb-8">
          <span className="bg-indigo-900 text-indigo-300 text-sm font-mono px-3 py-1 rounded-full">
            Exercise {currentMeta?.exercise}
          </span>
          <span className="bg-gray-800 text-gray-400 text-sm font-mono px-3 py-1 rounded-full">
            Q{currentMeta?.number}
          </span>
        </div>

        {/* Question */}
        <div className="w-full bg-gray-900 rounded-2xl border border-gray-800 p-8 mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-600 mb-4">Question</p>
          {current?.question_image ? (
            <div className="space-y-4">
              <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                {current.question_text}
              </p>
              <img
                src={current.question_image}
                alt="Question diagram"
                className="max-w-full rounded-lg border border-gray-700"
              />
            </div>
          ) : current?.question_text ? (
            <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">
              {current.question_text}
            </p>
          ) : (
            <p className="text-gray-600 italic">Question content not indexed yet.</p>
          )}
        </div>

        {/* Answer (revealed after space) */}
        {phase === PHASE.ANSWER && (
          <div className="w-full bg-gray-900 rounded-2xl border border-emerald-800 p-8 mb-6 animate-in fade-in duration-200">
            <p className="text-xs uppercase tracking-widest text-emerald-600 mb-4">Answer</p>
            {current?.answer_image ? (
              <div className="space-y-4">
                <p className="text-emerald-300 text-lg leading-relaxed whitespace-pre-wrap">
                  {current.answer_text}
                </p>
                <img
                  src={current.answer_image}
                  alt="Answer diagram"
                  className="max-w-full rounded-lg border border-gray-700"
                />
              </div>
            ) : current?.answer_text ? (
              <p className="text-emerald-300 text-lg leading-relaxed whitespace-pre-wrap">
                {current.answer_text}
              </p>
            ) : (
              <p className="text-gray-600 italic">Answer not indexed yet.</p>
            )}
          </div>
        )}

        {/* Hint / done */}
        {isDone ? (
          <div className="text-center">
            <p className="text-gray-400 text-lg mb-4">All done! 🎉</p>
            <button
              onClick={e => { e.stopPropagation(); onBack() }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Back to home
            </button>
          </div>
        ) : (
          <p className="text-gray-700 text-sm mt-2">
            {phase === PHASE.QUESTION ? 'Press Space to reveal answer' : 'Press Space for next question'}
          </p>
        )}
      </div>

      {/* Bottom keyboard hint */}
      <div className="px-6 py-4 border-t border-gray-800 flex justify-center gap-8 text-xs text-gray-700">
        <span>← → navigate</span>
        <span>Space — advance</span>
        <span>Esc — home</span>
      </div>
    </div>
  )
}

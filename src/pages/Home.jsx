import { useEffect, useState } from 'react'
import { fetchTopics } from '../lib/questions'

const SKIP_OPTIONS = [
  { label: 'All questions', skipEvery: 1, skipOffset: 0 },
  { label: 'Every other (Q1, Q3, Q5…)', skipEvery: 2, skipOffset: 0 },
  { label: 'Every third (Q1, Q4, Q7…)', skipEvery: 3, skipOffset: 0 },
  { label: 'Even questions only (Q2, Q4, Q6…)', skipEvery: 2, skipOffset: 1 },
]

export default function Home({ onStart }) {
  const [topics, setTopics] = useState([])
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [skipOption, setSkipOption] = useState(0)
  const [startExercise, setStartExercise] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchTopics()
      .then(data => {
        setTopics(data)
        if (data.length > 0) setSelectedTopic(data[0])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleTopicChange(e) {
    const t = topics.find(t => t.topic_code === e.target.value)
    setSelectedTopic(t)
    setStartExercise(0)
  }

  function handleStart() {
    if (!selectedTopic) return
    const skip = SKIP_OPTIONS[skipOption]
    onStart({
      topic: selectedTopic,
      startExerciseIndex: startExercise,
      skipEvery: skip.skipEvery,
      skipOffset: skip.skipOffset,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <p className="text-gray-400">Loading topics…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">Failed to load topics</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-gray-600 text-xs mt-4">
            Make sure your Supabase connection is configured and the database is set up.
          </p>
        </div>
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-white mb-3">No topics indexed yet</h1>
          <p className="text-gray-400 text-sm">
            Run the indexing scripts first to populate your Supabase database with SUP data and textbook questions.
          </p>
        </div>
      </div>
    )
  }

  const exercises = selectedTopic?.exercises ?? []

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-white mb-1">Methods Helper</h1>
        <p className="text-gray-500 text-sm mb-10">Mathematical Methods 1&amp;2</p>

        {/* Topic selector */}
        <div className="mb-6">
          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
            Topic
          </label>
          <select
            value={selectedTopic?.topic_code ?? ''}
            onChange={handleTopicChange}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {topics.map(t => (
              <option key={t.topic_code} value={t.topic_code}>
                {t.topic_code} — {t.topic_name}
              </option>
            ))}
          </select>
        </div>

        {/* Start exercise */}
        {exercises.length > 0 && (
          <div className="mb-6">
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
              Start from exercise
            </label>
            <select
              value={startExercise}
              onChange={e => setStartExercise(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {exercises.map((ex, i) => (
                <option key={ex.exercise} value={i}>
                  Exercise {ex.exercise} ({ex.questions.length} questions)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Skip pattern */}
        <div className="mb-8">
          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
            Question filter
          </label>
          <div className="space-y-2">
            {SKIP_OPTIONS.map((opt, i) => (
              <label
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  skipOption === i
                    ? 'border-indigo-500 bg-indigo-950 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="skip"
                  className="accent-indigo-500"
                  checked={skipOption === i}
                  onChange={() => setSkipOption(i)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Preview */}
        {selectedTopic && (
          <div className="mb-8 bg-gray-900 rounded-lg border border-gray-800 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Session preview</p>
            <div className="space-y-1 text-sm text-gray-300 max-h-40 overflow-y-auto">
              {exercises.slice(startExercise).map(ex => {
                const skip = SKIP_OPTIONS[skipOption]
                const filtered = ex.questions.filter((_, i) => (i - skip.skipOffset) % skip.skipEvery === 0)
                if (filtered.length === 0) return null
                return (
                  <div key={ex.exercise} className="flex gap-2">
                    <span className="text-indigo-400 font-mono font-medium w-10 shrink-0">
                      {ex.exercise}
                    </span>
                    <span className="text-gray-400">Q{filtered.join(', Q')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!selectedTopic || exercises.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-4 rounded-lg transition-colors text-lg"
        >
          Start session
        </button>

        <p className="text-center text-xs text-gray-700 mt-6">
          Space — reveal answer &nbsp;·&nbsp; Space again — next question
        </p>
      </div>
    </div>
  )
}

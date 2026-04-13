import { supabase } from './supabase'

/**
 * Fetch all subjects
 */
export async function fetchSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, code, name')
    .order('code')

  if (error) throw error
  return data
}

/**
 * Fetch all available topics (from SUP data)
 */
export async function fetchTopics(subjectId) {
  const { data, error } = await supabase
    .from('sup_data')
    .select('topic_code, topic_name, exercises')
    .eq('subject_id', subjectId)
    .order('topic_code')

  if (error) throw error
  return data
}

/**
 * Fetch SUP data for a specific topic
 * Returns exercises array: [{ exercise: "1A", questions: [1,3,5,7,9] }, ...]
 */
export async function fetchSupData(topicCode, subjectId) {
  const { data, error } = await supabase
    .from('sup_data')
    .select('topic_code, topic_name, exercises')
    .eq('subject_id', subjectId)
    .eq('topic_code', topicCode)
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch a specific question from the textbook index
 */
export async function fetchQuestion(exercise, questionNumber, subjectId) {
  const { data, error } = await supabase
    .from('textbook_questions')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('exercise', exercise)
    .eq('question_number', questionNumber)
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch all questions for a list of exercise+question pairs
 * questionsToFetch: [{ exercise: "1A", number: 1 }, ...]
 */
export async function fetchQuestionsForSession(questionsToFetch, subjectId) {
  const results = []
  // Batch by exercise to minimise queries
  const byExercise = {}
  for (const q of questionsToFetch) {
    if (!byExercise[q.exercise]) byExercise[q.exercise] = []
    byExercise[q.exercise].push(q.number)
  }

  for (const [exercise, numbers] of Object.entries(byExercise)) {
    const { data, error } = await supabase
      .from('textbook_questions')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('exercise', exercise)
      .in('question_number', numbers)
      .order('question_number')

    if (error) throw error
    results.push(...data)
  }

  // Re-sort to match original order
  return questionsToFetch.map(({ exercise, number }) =>
    results.find(r => r.exercise === exercise && r.question_number === number)
  ).filter(Boolean)
}

/**
 * Expand a SUP exercises list into a flat question list.
 * Note: Filtering is now applied at the sub-part level, not the question level.
 * This returns all question numbers in the exercises.
 */
export function buildQuestionList(exercises) {
  const list = []
  for (const ex of exercises) {
    for (const n of ex.questions) {
      list.push({ exercise: ex.exercise, number: n })
    }
  }
  return list
}

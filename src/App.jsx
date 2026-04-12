import { useState } from 'react'
import TextbookSelect from './pages/TextbookSelect'
import TopicSelect from './pages/TopicSelect'
import Home from './pages/Home'
import Session from './pages/Session'

export default function App() {
  const [subject, setSubject]             = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [sessionConfig, setSessionConfig] = useState(null)

  if (sessionConfig) {
    return (
      <Session
        config={sessionConfig}
        onBack={() => setSessionConfig(null)}
      />
    )
  }

  if (subject && selectedTopic) {
    return (
      <Home
        subject={subject}
        topic={selectedTopic}
        onStart={setSessionConfig}
        onBack={() => setSelectedTopic(null)}
      />
    )
  }

  if (subject) {
    return (
      <TopicSelect
        subject={subject}
        onSelect={setSelectedTopic}
        onBack={() => setSubject(null)}
      />
    )
  }

  return <TextbookSelect onSelect={setSubject} />
}

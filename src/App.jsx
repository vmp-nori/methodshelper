import { useState } from 'react'
import TextbookSelect from './pages/TextbookSelect'
import TopicSelect from './pages/TopicSelect'
import Home from './pages/Home'
import Session from './pages/Session'
import BugReportModal from './components/BugReportModal'

export default function App() {
  const [subject, setSubject]             = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [sessionConfig, setSessionConfig] = useState(null)
  const [reportOpen, setReportOpen]       = useState(false)
  const [reportContext, setReportContext] = useState(null)

  function openReport(ctx = null) {
    setReportContext(ctx)
    setReportOpen(true)
  }

  let page
  if (sessionConfig) {
    page = (
      <Session
        config={sessionConfig}
        onBack={() => setSessionConfig(null)}
        onReport={openReport}
      />
    )
  } else if (subject && selectedTopic) {
    page = (
      <Home
        subject={subject}
        topic={selectedTopic}
        onStart={setSessionConfig}
        onBack={() => setSelectedTopic(null)}
      />
    )
  } else if (subject) {
    page = (
      <TopicSelect
        subject={subject}
        onSelect={setSelectedTopic}
        onBack={() => setSubject(null)}
      />
    )
  } else {
    page = <TextbookSelect onSelect={setSubject} />
  }

  return (
    <>
      {page}

      {/* Floating report button */}
      <button
        onClick={() => openReport()}
        title="Report an issue"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 900,
          width: '36px', height: '36px',
          background: '#131313',
          border: '1px solid rgba(72,72,72,0.15)',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#484848',
          fontSize: '15px', lineHeight: 1,
          transition: 'all 0.2s',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(199,153,255,0.3)'
          e.currentTarget.style.color = '#c799ff'
          e.currentTarget.style.background = '#1a1a1a'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(72,72,72,0.15)'
          e.currentTarget.style.color = '#484848'
          e.currentTarget.style.background = '#131313'
        }}
      >
        ⚑
      </button>

      {/* Bug report modal */}
      {reportOpen && (
        <BugReportModal
          context={reportContext}
          onClose={() => { setReportOpen(false); setReportContext(null) }}
        />
      )}
    </>
  )
}

import { useState } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import TextbookSelect from './pages/TextbookSelect'
import TopicSelect from './pages/TopicSelect'
import Home from './pages/Home'
import Session from './pages/Session'
import BugReportModal from './components/BugReportModal'

function Wordmark() {
  const location = useLocation()
  const navigate  = useNavigate()

  // Only show on sub-pages
  if (location.pathname === '/') return null

  // Best-effort subject name from navigation state
  const subject = location.state?.subject ?? location.state?.config?.subjectId ?? null
  const subjectName = location.state?.subject?.name
    ?? location.state?.topic?.subject_name
    ?? null

  // Fall back to the code from the URL (e.g. "MM12")
  const subjectCode = location.pathname.split('/')[1]?.toUpperCase() ?? null
  const label = subjectName ?? subjectCode

  return (
    <button
      onClick={() => navigate('/')}
      title="Back to textbook selection"
      style={{
        position: 'fixed', top: 24, left: 28, zIndex: 950,
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '6px 10px 6px 6px',
        borderRadius: 10,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {/* Logo mark */}
      <div style={{
        width: 36, height: 36,
        background: 'linear-gradient(135deg, #c799ff22, #7c3aed44)',
        border: '1px solid rgba(199,153,255,0.2)',
        borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'serif', fontSize: 17, fontWeight: 700, color: '#c799ff',
        flexShrink: 0,
      }}>
        Σ
      </div>

      {/* Text */}
      <div style={{ textAlign: 'left' }}>
        <div style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: 15, fontWeight: 800,
          color: '#e7e5e5', letterSpacing: '-0.025em',
          lineHeight: 1.2,
        }}>
          SUPsmasher
        </div>
        {label && (
          <div style={{
            fontSize: 9, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: '#484848',
            marginTop: 2,
          }}>
            {label}
          </div>
        )}
      </div>
    </button>
  )
}

export default function App() {
  const [reportOpen, setReportOpen]     = useState(false)
  const [reportContext, setReportContext] = useState(null)

  function openReport(ctx = null) {
    setReportContext(ctx)
    setReportOpen(true)
  }

  return (
    <>
      <Routes>
        <Route path="/"                                  element={<TextbookSelect />} />
        <Route path="/:subjectCode"                      element={<TopicSelect />} />
        <Route path="/:subjectCode/:topicCode"           element={<Home />} />
        <Route path="/:subjectCode/:topicCode/session"   element={<Session onReport={openReport} />} />
      </Routes>

      {/* Persistent wordmark — hidden on root */}
      <Wordmark />

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

      {reportOpen && (
        <BugReportModal
          context={reportContext}
          onClose={() => { setReportOpen(false); setReportContext(null) }}
        />
      )}
    </>
  )
}

import { useState } from 'react'
import { Routes, Route, useLocation, useNavigate, Link } from 'react-router-dom'
import TextbookSelect from './pages/TextbookSelect'
import TopicSelect from './pages/TopicSelect'
import Home from './pages/Home'
import Session from './pages/Session'
import Settings from './pages/Settings'
import BugReportModal from './components/BugReportModal'
import { useIsMobile } from './lib/hooks'

function Wordmark() {
  const location = useLocation()
  const navigate  = useNavigate()
  const isMobile = useIsMobile()

  // Hidden on root — desktop pages now use this persistent wordmark too
  if (location.pathname === '/') return null
  if (location.pathname === '/settings') return null

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
        position: 'fixed', 
        top: isMobile ? 12 : 24, 
        left: isMobile ? 16 : 28, 
        zIndex: 950,
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
        width: isMobile ? 32 : 36, height: isMobile ? 32 : 36,
        background: 'linear-gradient(135deg, #c799ff22, #7c3aed44)',
        border: '1px solid rgba(199,153,255,0.2)',
        borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'serif', fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#c799ff',
        flexShrink: 0,
      }}>
        Σ
      </div>

      {/* Text */}
      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', height: isMobile ? 32 : 36, justifyContent: 'space-between', padding: '2px 0' }}>
        <div style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: isMobile ? 13 : 15, fontWeight: 800,
          color: '#e7e5e5', letterSpacing: '-0.025em',
          lineHeight: 1,
        }}>
          SUPsmasher
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: -2 }}>
          <span style={{ 
            fontSize: isMobile ? 7 : 8, 
            color: '#c799ff', 
            background: 'rgba(199,153,255,0.1)', 
            padding: '2px 5px', 
            borderRadius: 4,
            fontWeight: 800,
            letterSpacing: '0.05em',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1,
          }}>BETA</span>
          {label && (
            <div style={{
              fontSize: isMobile ? 8 : 9, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: '#484848',
              lineHeight: 1,
            }}>
              {label}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function SocialLink() {
  const isMobile = useIsMobile()
  const location = useLocation()
  
  if (location.pathname === '/') return null
  if (location.pathname === '/settings') return null

  return (
    <a
      href="https://instagram.com/notnorin"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed',
        bottom: `calc(${isMobile ? '16px' : '24px'} + env(safe-area-inset-bottom))`,
        left: isMobile ? '16px' : '24px',
        zIndex: 900,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        background: '#131313',
        border: '1px solid rgba(72,72,72,0.15)',
        borderRadius: 9999,
        textDecoration: 'none',
        transition: 'all 0.2s',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(199,153,255,0.3)'
        e.currentTarget.style.background = '#1a1a1a'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(72,72,72,0.15)'
        e.currentTarget.style.background = '#131313'
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c799ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
      <span style={{
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: 11, fontWeight: 700, color: '#e7e5e5',
        letterSpacing: '0.02em'
      }}>
        @notnorin
      </span>
    </a>
  )
}

export default function App() {
  const [reportOpen, setReportOpen]     = useState(false)
  const [reportContext, setReportContext] = useState(null)
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()

  function openReport(ctx = null) {
    setReportContext(ctx)
    setReportOpen(true)
  }

  const isRoot = location.pathname === '/'
  const isSettings = location.pathname === '/settings'
  const isSession = location.pathname.endsWith('/session')

  return (
    <>
      <Routes>
        <Route path="/"                                  element={<TextbookSelect />} />
        <Route path="/settings"                          element={<Settings />} />
        <Route path="/:subjectCode"                      element={<TopicSelect />} />
        <Route path="/:subjectCode/:topicCode"           element={<Home />} />
        <Route path="/:subjectCode/:topicCode/session"   element={<Session onReport={openReport} />} />
      </Routes>

      {/* Persistent wordmark — hidden on root */}
      <Wordmark />

      {/* Instagram link */}
      <SocialLink />

      {/* Dark shield strip behind the wordmark so scrolling content doesn't bleed through */}
      {!isRoot && !isSession && !isSettings && <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: isMobile ? 64 : 80,
        background: '#0e0e0e',
        zIndex: 940,
        pointerEvents: 'none',
      }} />}

      {/* Floating utility buttons */}
      <div style={{
        position: 'fixed', 
        bottom: `calc(${isMobile ? '16px' : '24px'} + env(safe-area-inset-bottom))`, 
        right: isMobile ? '16px' : '24px', 
        zIndex: 900,
        display: 'flex',
        gap: 12
      }}>
        {/* Settings Button */}
        {!isSettings && (
          <button
            onClick={() => navigate('/settings')}
            title="Settings"
            style={{
              width: '36px', height: '36px',
              background: '#131313',
              border: '1px solid rgba(72,72,72,0.15)',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#484848',
              fontSize: '18px', lineHeight: 1,
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
            ⚙
          </button>
        )}

        {/* Floating report button */}
        <button
          onClick={() => openReport()}
          title="Report an issue"
          style={{
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
      </div>

      {reportOpen && (
        <BugReportModal
          context={reportContext}
          onClose={() => { setReportOpen(false); setReportContext(null) }}
        />
      )}
    </>
  )
}


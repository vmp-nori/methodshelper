import { LayoutGrid, FileText, History, Settings, HelpCircle } from 'lucide-react'

export default function Sidebar({ activePage = 'session' }) {
  return (
    <aside
      style={{ background: '#111111', borderRight: '1px solid #1e1e1e', width: 60 }}
      className="flex flex-col items-center py-4 gap-2 shrink-0 h-screen"
    >
      {/* Logo */}
      <div
        style={{ background: '#1e1e1e', color: '#fff', fontFamily: 'serif', fontWeight: 700, fontSize: 18 }}
        className="w-9 h-9 rounded-full flex items-center justify-center mb-4"
      >
        Σ
      </div>

      {/* Nav icons */}
      <NavIcon icon={LayoutGrid} active={activePage === 'session'} />
      <NavIcon icon={FileText} active={activePage === 'notes'} />
      <NavIcon icon={History} active={activePage === 'history'} />
      <NavIcon icon={Settings} active={activePage === 'settings'} />

      <div className="flex-1" />

      <NavIcon icon={HelpCircle} active={false} />
    </aside>
  )
}

function NavIcon({ icon: Icon, active }) {
  return (
    <button
      style={{
        background: active ? '#7c3aed22' : 'transparent',
        color: active ? '#a78bfa' : '#4b4b4b',
        borderRadius: 8,
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        transition: 'color 0.15s, background 0.15s',
      }}
    >
      <Icon size={18} />
    </button>
  )
}

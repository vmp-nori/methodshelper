import { useState } from 'react'
import Home from './pages/Home'
import Session from './pages/Session'

export default function App() {
  const [sessionConfig, setSessionConfig] = useState(null)

  if (sessionConfig) {
    return (
      <Session
        config={sessionConfig}
        onBack={() => setSessionConfig(null)}
      />
    )
  }

  return <Home onStart={setSessionConfig} />
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '../lib/hooks'

export default function Settings() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash-8b')
  const [loadingModels, setLoadingModels] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key')
    if (storedKey) setApiKey(storedKey)
    
    const storedModel = localStorage.getItem('gemini_model')
    if (storedModel) setSelectedModel(storedModel)
  }, [])

  async function fetchModels() {
    if (!apiKey) return
    setLoadingModels(true)
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)
      const data = await response.json()
      if (data.models) {
        const filtered = data.models
          .filter(m => m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace('models/', ''))
        setModels(filtered)
        if (!filtered.includes(selectedModel) && filtered.length > 0) {
          setSelectedModel(filtered[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err)
    } finally {
      setLoadingModels(false)
    }
  }

  function handleSave() {
    localStorage.setItem('gemini_api_key', apiKey)
    localStorage.setItem('gemini_model', selectedModel)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e0e0e',
      color: '#e7e5e5',
      fontFamily: 'Inter, sans-serif',
      padding: isMobile ? '80px 20px' : '100px 40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: '#484848',
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: 32,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          ← Go Back
        </button>

        <h1 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: isMobile ? 28 : 36,
          fontWeight: 800,
          marginBottom: 8,
          letterSpacing: '-0.02em'
        }}>
          Settings
        </h1>
        <p style={{ color: '#9f9d9d', fontSize: 14, marginBottom: 40 }}>
          Configure your Gemini AI integration to get live help with questions.
        </p>

        <div style={{
          background: '#131313',
          border: '1px solid rgba(72,72,72,0.15)',
          borderRadius: 16,
          padding: isMobile ? 20 : 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 700,
            color: '#c799ff',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 12
          }}>
            Google Gemini API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Enter your API key here..."
            style={{
              width: '100%',
              background: '#0e0e0e',
              border: '1px solid rgba(72,72,72,0.3)',
              borderRadius: 8,
              padding: '12px 16px',
              color: '#e7e5e5',
              fontSize: 14,
              fontFamily: 'monospace',
              marginBottom: 16,
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#c799ff'}
            onBlur={e => e.target.style.borderColor = 'rgba(72,72,72,0.3)'}
          />
          <p style={{ fontSize: 12, color: '#484848', lineHeight: 1.5, marginBottom: 24 }}>
            Your API key is stored locally in your browser and is only used to communicate with Google's Gemini API. 
            You can get an API key from the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#c799ff', textDecoration: 'none' }}>Google AI Studio</a>.
          </p>

          <button
            onClick={handleSave}
            style={{
              background: saved ? '#10b981' : '#c799ff',
              color: '#0e0e0e',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: isMobile ? '100%' : 'auto',
              marginBottom: 32
            }}
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </button>

          <div style={{ borderTop: '1px solid rgba(72,72,72,0.15)', paddingTop: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: '#c799ff',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 12
            }}>
              Model Selection
            </label>
            
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0e0e0e',
                  border: '1px solid rgba(72,72,72,0.3)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#e7e5e5',
                  fontSize: 14,
                  outline: 'none',
                  appearance: 'none'
                }}
              >
                {models.length > 0 ? (
                  models.map(m => <option key={m} value={m}>{m}</option>)
                ) : (
                  <option value={selectedModel}>{selectedModel}</option>
                )}
              </select>
              <button
                onClick={fetchModels}
                disabled={!apiKey || loadingModels}
                style={{
                  background: '#1f2020',
                  color: '#e7e5e5',
                  border: '1px solid rgba(72,72,72,0.3)',
                  borderRadius: 8,
                  padding: '0 16px',
                  fontSize: 12,
                  cursor: (apiKey && !loadingModels) ? 'pointer' : 'default',
                  opacity: (apiKey && !loadingModels) ? 1 : 0.5
                }}
              >
                {loadingModels ? '...' : 'Refresh'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#484848' }}>
              We recommend using the latest <strong>Flash</strong> model for speed and cost-efficiency.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

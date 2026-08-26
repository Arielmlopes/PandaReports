import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { AppProvider } from './contexts/AppContext.jsx'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

// Sem essas variaveis o app trava numa tela em branco (createClient do Supabase
// lanca erro no carregamento do modulo, antes de qualquer render). Como isso
// so acontece em producao (o .env local sempre tem os valores), mostramos um
// aviso claro em vez de deixar a tela em branco sem explicacao nenhuma.
const missingEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !import.meta.env[k])

if (missingEnv.length > 0) {
  root.render(
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#0f0f0f',
        color: '#f8f8f8',
        fontFamily: 'sans-serif',
        padding: 24,
        textAlign: 'center'
      }}
    >
      <span style={{ fontSize: 40 }}>🐼</span>
      <h1 style={{ fontSize: 18, margin: 0 }}>Configuração incompleta</h1>
      <p style={{ color: '#a0a0a0', maxWidth: 420, margin: 0 }}>
        Faltam variáveis de ambiente no deploy: <strong>{missingEnv.join(', ')}</strong>. Configure-as em Netlify →
        Site settings → Environment variables e faça um novo deploy.
      </p>
    </div>
  )
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
}

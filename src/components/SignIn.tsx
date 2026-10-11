import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.trim() || !password) {
      setError('Correo y contraseña son obligatorios')
      return
    }
    setBusy(true)
    const { error: signInError } = await supabase!.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (signInError) {
      // Do not reveal whether the account exists (security over convenience).
      setError('Correo o contraseña incorrectos')
    }
    // On success the auth state listener in App switches to the dashboard.
  }

  async function handleMagicLink() {
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError('Escribe tu correo para recibir el enlace')
      return
    }
    setBusy(true)
    const { error: linkError } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
    })
    setBusy(false)
    if (linkError) setError('No se pudo enviar el enlace. Intenta de nuevo.')
    else setInfo('Revisa tu correo: te enviamos un enlace para entrar.')
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>
          <LogIn size={20} aria-hidden="true" /> Panel de Impresión 3D
        </h1>
        <p className="small muted">Inicia sesión para ver tus registros.</p>
        <div className="field">
          <label htmlFor="auth-email">Correo</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>
        <div className="field">
          <label htmlFor="auth-password">Contraseña</label>
          <input
            id="auth-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
        {info && (
          <span className="small profit-positive" role="status">
            {info}
          </span>
        )}
        <div className="form-actions">
          <button type="submit" className="btn" disabled={busy}>
            <LogIn size={16} aria-hidden="true" /> Iniciar sesión
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleMagicLink}
            disabled={busy}
          >
            Enviar enlace mágico
          </button>
        </div>
      </form>
    </main>
  )
}

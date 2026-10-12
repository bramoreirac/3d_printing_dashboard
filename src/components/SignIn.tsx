import { useState } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

const MIN_PASSWORD_LENGTH = 8

export function SignIn() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    const cleanEmail = email.trim()
    if (!cleanEmail || !password) {
      setError('Correo y contraseña son obligatorios')
      return
    }

    if (mode === 'signin') {
      setBusy(true)
      const { error: signInError } = await supabase!.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })
      setBusy(false)
      if (signInError) {
        // Do not reveal whether the account exists (security over convenience).
        setError('Correo o contraseña incorrectos')
      }
      // On success the auth state listener in App switches to the dashboard.
      return
    }

    // Sign-up validation
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setBusy(true)
    const { data, error: signUpError } = await supabase!.auth.signUp({
      email: cleanEmail,
      password,
    })
    setBusy(false)

    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      if (signUpError.code === 'user_already_exists' || msg.includes('already registered')) {
        setError('Ya existe una cuenta con ese correo. Inicia sesión.')
      } else if (msg.includes('password')) {
        setError('La contraseña no cumple los requisitos. Usa al menos 8 caracteres.')
      } else {
        setError('No se pudo crear la cuenta. Intenta de nuevo.')
      }
      return
    }

    // No session means the project requires email confirmation first;
    // with confirmation disabled, signUp returns a session and the
    // auth listener logs the user straight in.
    if (!data.session) {
      setInfo('Cuenta creada. Revisa tu correo para confirmar tu cuenta y luego inicia sesión.')
      setMode('signin')
      setPassword('')
      setConfirm('')
    }
  }

  const isSignIn = mode === 'signin'

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>
          {isSignIn ? (
            <>
              <LogIn size={20} aria-hidden="true" /> Panel de Impresión 3D
            </>
          ) : (
            <>
              <UserPlus size={20} aria-hidden="true" /> Crear cuenta
            </>
          )}
        </h1>
        <p className="small muted">
          {isSignIn
            ? 'Inicia sesión para ver tus registros.'
            : 'Crea tu cuenta para empezar a usar el panel.'}
        </p>
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
            autoComplete={isSignIn ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>
        {!isSignIn && (
          <div className="field">
            <label htmlFor="auth-confirm">Confirmar contraseña</label>
            <input
              id="auth-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </div>
        )}
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
            {isSignIn ? (
              <>
                <LogIn size={16} aria-hidden="true" /> Iniciar sesión
              </>
            ) : (
              <>
                <UserPlus size={16} aria-hidden="true" /> Crear cuenta
              </>
            )}
          </button>
        </div>
        <button
          type="button"
          className="auth-switch"
          onClick={() => switchMode(isSignIn ? 'signup' : 'signin')}
        >
          {isSignIn
            ? '¿No tienes cuenta? Crear una cuenta'
            : '¿Ya tienes cuenta? Iniciar sesión'}
        </button>
      </form>
    </main>
  )
}

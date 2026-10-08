import { useState } from 'react'
import { supabase } from '../supabase'

function friendlyAuthError(message) {
  if (!message) return 'Something went wrong. Please try again.'
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (lower.includes('already registered')) return 'An account with this email already exists.'
  if (lower.includes('email not confirmed')) return 'Please confirm your email before signing in.'
  return message
}

const AuthForm = () => {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(null)

  const isSignUp = mode === 'signup'
  const isForgot = mode === 'forgot'

  function switchMode(nextMode) {
    setMode(nextMode)
    setError(null)
    setNotice(null)
    setUnconfirmedEmail(null)
  }

  function handleEmailChange(e) {
    setEmail(e.target.value)
    if (error) setError(null)
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value)
    if (error) setError(null)
  }

  async function handleResendConfirmation() {
    if (!unconfirmedEmail) return
    setIsSubmitting(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: unconfirmedEmail })
    setIsSubmitting(false)
    if (error) { setError(friendlyAuthError(error.message)); return }
    setNotice('Confirmation email resent. Check your inbox.')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setUnconfirmedEmail(null)
    setIsSubmitting(true)

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      })
      setIsSubmitting(false)
      if (error) { setError(friendlyAuthError(error.message)); return }
      setNotice("If an account exists for that email, we've sent a reset link.")
      return
    }

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      setIsSubmitting(false)
      if (error) { setError(friendlyAuthError(error.message)); return }
      if (!data.session) {
        setNotice('Check your email to confirm your account before signing in.')
      }
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setIsSubmitting(false)
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setUnconfirmedEmail(email)
      }
      setError(friendlyAuthError(error.message))
    }
  }

  return (
    <form className="authForm" onSubmit={handleSubmit}>
      <h2>{isForgot ? 'Reset password' : isSignUp ? 'Create account' : 'Sign in'}</h2>

      <label className="visually-hidden" htmlFor="auth-email">Email</label>
      <input
        id="auth-email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={handleEmailChange}
        disabled={isSubmitting}
        required
      />

      {!isForgot && (
        <>
          <label className="visually-hidden" htmlFor="auth-password">Password</label>
          <div className="authPasswordField">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={handlePasswordChange}
              disabled={isSubmitting}
              required
            />
            <button
              type="button"
              className="authPasswordToggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={isSubmitting}
            >
              <i className={showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'}></i>
            </button>
          </div>
        </>
      )}

      {error && <p className="authError" role="alert">{error}</p>}
      {notice && <p className="authNotice" aria-live="polite">{notice}</p>}

      {unconfirmedEmail && (
        <button type="button" onClick={handleResendConfirmation} disabled={isSubmitting}>
          Resend confirmation email
        </button>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? (isForgot ? 'Sending…' : isSignUp ? 'Creating account…' : 'Signing in…')
          : (isForgot ? 'Send reset link' : isSignUp ? 'Sign up' : 'Sign in')}
      </button>

      {!isForgot && (
        <button type="button" onClick={() => switchMode(isSignUp ? 'signin' : 'signup')} disabled={isSubmitting}>
          {isSignUp ? 'Already have an account? Sign in' : 'No account? Sign up'}
        </button>
      )}

      {mode === 'signin' && (
        <button type="button" className="authLinkButton" onClick={() => switchMode('forgot')} disabled={isSubmitting}>
          Forgot password?
        </button>
      )}

      {isForgot && (
        <button type="button" className="authLinkButton" onClick={() => switchMode('signin')} disabled={isSubmitting}>
          Back to sign in
        </button>
      )}
    </form>
  )
}

export default AuthForm

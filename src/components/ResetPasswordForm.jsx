import { useState } from 'react'
import { supabase } from '../supabase'

const ResetPasswordForm = ({ onDone }) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handlePasswordChange(e) {
    setPassword(e.target.value)
    if (error) setError(null)
  }

  function handleConfirmPasswordChange(e) {
    setConfirmPassword(e.target.value)
    if (error) setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (error) { setError(error.message); return }
    onDone?.()
  }

  return (
    <form className="authForm" onSubmit={handleSubmit}>
      <h2>Set a new password</h2>

      <label className="visually-hidden" htmlFor="reset-password">New password</label>
      <input
        id="reset-password"
        type="password"
        placeholder="New password"
        autoComplete="new-password"
        value={password}
        onChange={handlePasswordChange}
        disabled={isSubmitting}
        required
      />

      <label className="visually-hidden" htmlFor="reset-password-confirm">Confirm new password</label>
      <input
        id="reset-password-confirm"
        type="password"
        placeholder="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={handleConfirmPasswordChange}
        disabled={isSubmitting}
        required
      />

      {error && <p className="authError" role="alert">{error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  )
}

export default ResetPasswordForm

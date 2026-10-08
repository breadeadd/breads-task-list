# Authentication

## Overview

This is the current reference for the app's auth system, as implemented in `src/components/AuthForm.jsx`, `src/components/ResetPasswordForm.jsx`, and the auth wiring in `src/App.jsx`. (For a from-scratch walkthrough of wiring Supabase Auth into a project for the first time, see [SUPABASE.md](SUPABASE.md) section 3 — that's a simplified teaching version; this doc covers what's actually shipped.)

Auth is entirely client-side via the Supabase JS SDK (`supabase.auth.*`) — there's no custom backend route. The app has no router, so every auth screen (sign in, sign up, forgot password, reset password) is a different render state of the same single-page app, not a different URL.

---

## `AuthForm.jsx`: the `mode` state machine

`AuthForm` renders one of three modes, tracked by a single `mode` state variable:

| Mode | What's shown | Submit action |
|---|---|---|
| `'signin'` | Email + password | `supabase.auth.signInWithPassword({ email, password })` |
| `'signup'` | Email + password | `supabase.auth.signUp({ email, password })` |
| `'forgot'` | Email only | `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })` |

`switchMode(nextMode)` changes `mode` and clears `error`, `notice`, and `unconfirmedEmail` so stale messages don't carry over between modes.

---

## Loading and error states

- `isSubmitting` disables every input and button for the duration of the Supabase call and swaps the submit button's label (e.g. "Signing in…"), preventing duplicate submits on a slow connection or a double-click.
- `error` is cleared as soon as the user edits the email or password field (`handleEmailChange`/`handlePasswordChange`), not just on the next submit — so a stale "incorrect password" message doesn't linger after they've started fixing it.
- Raw Supabase error messages are passed through `friendlyAuthError(message)`, which maps a few common cases to clearer copy (incorrect credentials, already-registered email, unconfirmed email) and falls back to the original message for anything else.

---

## Password visibility toggle

The password field's `type` toggles between `"password"` and `"text"` via `showPassword` state and an eye-icon button (`.authPasswordToggle`), with `aria-label` reflecting the current action ("Show password" / "Hide password").

---

## Accessibility

- Email and password inputs each have a `<label>` (visually hidden via the `.visually-hidden` utility class in `src/index.css`, so the placeholder-driven visual design is unchanged but screen readers get a real accessible name instead of relying on the placeholder).
- `autoComplete="email"` on the email field; `autoComplete="new-password"` in sign-up mode, `"current-password"` in sign-in mode.
- The error message renders with `role="alert"` so assistive tech announces it as it appears.

---

## Email confirmation

If the Supabase project has "Confirm email" enabled, `signUp` returns a `user` but no `session`. `AuthForm` checks for this (`!data.session`) and shows a persistent notice ("Check your email to confirm your account") instead of doing nothing, which is what the bare tutorial version in SUPABASE.md does.

If a user tries to sign in before confirming, Supabase returns an "Email not confirmed" error. `AuthForm` detects this specifically, stores the attempted email in `unconfirmedEmail`, and shows a "Resend confirmation email" button that calls:

```js
supabase.auth.resend({ type: 'signup', email: unconfirmedEmail })
```

---

## Forgot password / reset flow

This is the one flow that spans multiple components and an email round-trip:

1. **Request** — in `'forgot'` mode, `AuthForm` calls `resetPasswordForEmail(email, { redirectTo: window.location.origin })`. Regardless of whether the email actually belongs to an account, the UI shows the same generic notice ("If an account exists for that email, we've sent a reset link") — this avoids leaking which emails have accounts.
2. **Email link** — Supabase emails the user a link back to `window.location.origin` with recovery tokens in the URL. The Supabase client has `detectSessionInUrl` on by default, so it picks these up automatically on load — no custom route handling needed.
3. **Recovery event** — `App.jsx`'s existing `onAuthStateChange` listener now captures the `event` argument (previously discarded) and sets `isPasswordRecovery = true` when `event === 'PASSWORD_RECOVERY'`:
   ```js
   const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
     if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
     setUser(session?.user ?? null)
   })
   ```
4. **New password** — `App.jsx`'s render gate checks `isPasswordRecovery` before the normal `!user` check, rendering `<ResetPasswordForm onDone={...} />` instead of the main app:
   ```js
   if (authLoading) return <div>Loading...</div>
   if (isPasswordRecovery) return <ResetPasswordForm onDone={() => setIsPasswordRecovery(false)} />
   if (!user) return <AuthForm />
   ```
5. **`ResetPasswordForm.jsx`** validates the new password locally (minimum length, matches confirmation), then calls `supabase.auth.updateUser({ password })`. On success it calls `onDone`, clearing `isPasswordRecovery` so the app falls through to the normal authenticated view (the recovery link already signs the user in).

---

## Deliberately out of scope

These were considered but not built, since they're bigger product decisions rather than gaps in the existing flow:

- "Remember me" / session-length controls.
- A "sign out of all devices" action.
- Rate-limit/lockout-specific messaging beyond the generic error text.
- A `ProtectedRoute` abstraction — not needed while the app has only one authenticated view.
- Automated tests — none exist for anything in this app yet, not just auth.

---

## Further Reading

- [SUPABASE.md](SUPABASE.md) — Original from-scratch setup tutorial (schema, RLS, minimal auth wiring).
- [ARCHITECTURE.md](ARCHITECTURE.md) — Where auth fits in the overall component structure.

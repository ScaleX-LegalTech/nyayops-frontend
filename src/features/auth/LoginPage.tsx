import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { login, loginMfa, loginOtp, requestMfaEmailFallback } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Field, Input, PasswordInput } from '@/components/ui/Field'
import { AuthLayout } from './AuthLayout'

export default function LoginPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [step, setStep] = useState<'credentials' | 'mfa' | 'otp'>('credentials')
  const [tenantSlug, setTenantSlug] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fallbackLoading, setFallbackLoading] = useState(false)

  async function submitCredentials(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await login(email, password, tenantSlug)
      if (res.mfa_required && res.mfa_token) {
        setMfaToken(res.mfa_token)
        setStep('mfa')
      } else if (res.otp_required && res.otp_token) {
        setOtpToken(res.otp_token)
        setStep('otp')
      } else {
        setSession(res)
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await loginMfa(mfaToken, code)
      setSession(res)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid verification code.')
    } finally {
      setLoading(false)
    }
  }

  async function useEmailFallback() {
    setError(null)
    setFallbackLoading(true)
    try {
      const res = await requestMfaEmailFallback(mfaToken)
      if (res.otp_required && res.otp_token) {
        setOtpToken(res.otp_token)
        setCode('')
        setStep('otp')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to email a code right now.')
    } finally {
      setFallbackLoading(false)
    }
  }

  async function submitOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await loginOtp(otpToken, code)
      setSession(res)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired verification code.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'mfa' || step === 'otp') {
    const isMfa = step === 'mfa'
    return (
      <AuthLayout>
        <button
          onClick={() => {
            setStep('credentials')
            setCode('')
            setError(null)
          }}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-control bg-brand-soft text-brand">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              {isMfa ? 'Two-step verification' : "Verify it's you"}
            </h1>
            <p className="text-sm text-ink-muted">
              {isMfa
                ? 'Enter the code from your authenticator app.'
                : 'We emailed a code to confirm this sign-in.'}
            </p>
          </div>
        </div>
        <form onSubmit={isMfa ? submitMfa : submitOtp} className="space-y-4">
          <Field label="Verification code" htmlFor="code">
            <PasswordInput
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center font-mono text-lg tracking-[0.4em]"
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={loading} className="w-full justify-center">
            Verify & sign in
          </Button>
          {isMfa && (
            <button
              type="button"
              onClick={useEmailFallback}
              disabled={fallbackLoading}
              className="block w-full text-center text-sm font-medium text-brand hover:text-brand-strong disabled:opacity-60"
            >
              Can't access your authenticator? Email me a code instead.
            </button>
          )}
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to your organization's workspace.</p>
      </div>
      <form onSubmit={submitCredentials} className="space-y-4">
        <Field label="Organization" htmlFor="tenant" hint="Your workspace slug, e.g. acme-legal">
          <Input
            id="tenant"
            autoFocus
            placeholder="acme-legal"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            required
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@firm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Link to="/forgot-password" className="block text-sm font-medium text-brand hover:text-brand-strong">
          Forgot password?
        </Link>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={loading} className="w-full justify-center">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        New organization?{' '}
        <Link to="/register" className="font-medium text-brand hover:text-brand-strong">
          Register a tenant
        </Link>
      </p>
    </AuthLayout>
  )
}

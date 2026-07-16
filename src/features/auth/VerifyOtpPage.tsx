import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { loginOtp } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Field, PasswordInput } from '@/components/ui/Field'
import { AuthLayout } from './AuthLayout'

export default function VerifyOtpPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const otpToken = searchParams.get('token') ?? ''
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const autoSubmitted = useRef(false)

  async function verify(codeToVerify: string) {
    setError(null)
    setLoading(true)
    try {
      const res = await loginOtp(otpToken, codeToVerify)
      setSession(res)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired verification code.')
    } finally {
      setLoading(false)
    }
  }

  // Clicking the magic link lands here with both `token` and `code` already
  // filled in - complete verification immediately without requiring a click.
  useEffect(() => {
    if (otpToken && code && !autoSubmitted.current) {
      autoSubmitted.current = true
      void verify(code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    void verify(code)
  }

  return (
    <AuthLayout>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-control bg-brand-soft text-brand">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Verify it's you</h1>
          <p className="text-sm text-ink-muted">
            We emailed a code to confirm this is a sign-in you recognize.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
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
      </form>
    </AuthLayout>
  )
}

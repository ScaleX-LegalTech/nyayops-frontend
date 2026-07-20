import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { loginOtp, registerTenant, type RegisterTenantPayload } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { Field, Input, PasswordInput } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { AuthLayout } from './AuthLayout'
import { BootstrapChat } from './BootstrapChat'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [mode, setMode] = useState<'form' | 'chat'>('form')
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /** Shared by the form's submit and BootstrapChat's confirm card - one
   * registration path regardless of how the fields were gathered. */
  async function completeRegistration(payload: RegisterTenantPayload) {
    setError(null)
    setLoading(true)
    try {
      const res = await registerTenant(payload)
      setAdminEmail(payload.admin_email)
      if (res.otp_required && res.otp_token) {
        setOtpToken(res.otp_token)
        setStep('otp')
      } else {
        setSession(res)
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void completeRegistration({
      organization_name: orgName,
      organization_slug: slug,
      admin_name: adminName,
      admin_email: adminEmail,
      admin_password: password,
    })
  }

  async function submitOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await loginOtp(otpToken, code)
      setSession(res)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired verification code.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'otp') {
    return (
      <AuthLayout>
        <button
          onClick={() => {
            setStep('details')
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
            <h1 className="font-display text-2xl font-semibold text-ink">Verify your email</h1>
            <p className="text-sm text-ink-muted">
              We emailed a code to <span className="font-medium text-ink">{adminEmail}</span> to
              confirm it's really you.
            </p>
          </div>
        </div>
        <form onSubmit={submitOtp} className="space-y-4">
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
            Verify & create organization
          </Button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Register your firm
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Create a workspace and its first administrator.
          </p>
        </div>
        <div className="flex gap-1 rounded-control border border-border bg-surface-muted p-1">
          {(
            [
              ['form', 'Fill out the form'],
              ['chat', 'Chat instead'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={cn(
                'rounded-control px-3 py-1.5 text-sm font-medium transition-colors',
                value === mode ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'chat' ? (
        <BootstrapChat onRegister={completeRegistration} registering={loading} registerError={error} />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Organization name" htmlFor="org">
            <Input
              id="org"
              autoFocus
              placeholder="Acme Legal LLP"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              required
            />
          </Field>
          <Field label="Workspace slug" htmlFor="slug" hint="Used to sign in. Lowercase, no spaces.">
            <Input
              id="slug"
              placeholder="acme-legal"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
              required
            />
          </Field>
          <Field label="Admin name" htmlFor="adminName">
            <Input
              id="adminName"
              placeholder="Priya Sharma"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
            />
          </Field>
          <Field label="Admin email" htmlFor="adminEmail">
            <Input
              id="adminEmail"
              type="email"
              placeholder="priya@acme.legal"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="pw" hint="At least 10 characters.">
            <PasswordInput
              id="pw"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={loading} className="w-full justify-center">
            Create organization
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have a workspace?{' '}
        <Link to="/login" className="font-medium text-brand hover:text-brand-strong">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

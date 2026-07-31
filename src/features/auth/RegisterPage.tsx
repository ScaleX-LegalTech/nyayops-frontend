import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { loginOtp, registerTenant, type RegisterTenantPayload } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { Field, Input, PasswordInput } from '@/components/ui/Field'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
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

interface WelcomeStepProps {
  onSignIn: () => void
  onCreateAccount: () => void
  onAskAi: () => void
}

/** The front door: a chooser, not a form (registration has no fields to fill
 * in yet at this point) - "Sign in" and "Create account" split traffic
 * between the two real destinations, "Ask NyayOps AI" jumps straight into
 * BootstrapChat as a third, faster entry point.
 *
 * The reference mockup is a phone-frame screenshot: a card floating on a
 * plain canvas, not literal edge-to-edge content. Porting it as full-bleed
 * page content stretched vertically past one viewport (forcing a scroll to
 * reach the AI button) and left the wide desktop viewport looking empty on
 * either side of a narrow centered column. This keeps the same content but
 * renders it inside a fixed-height card - the card is the "phone", the page
 * behind it is a dotted backdrop (same trick AuthLayout's aside already
 * uses) that fills the wide viewport with intent instead of blank space. */
function WelcomeStep({ onSignIn, onCreateAccount, onAskAi }: WelcomeStepProps) {
  return (
    <div className="grid h-dvh place-items-center overflow-hidden bg-bg p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />
      <div className="relative flex h-full max-h-[44rem] w-full max-w-sm flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-8">
          <div className="flex items-center justify-center gap-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-control bg-accent/15">
              <img src="/logo.png" alt="" className="size-7 object-contain" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-ink">
              Nyay<span className="text-brand">Ops</span>
            </span>
          </div>

          <div className="mt-6 text-center">
            <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
              One workspace for every legal operation
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Streamline casework. Stay organized. Work smarter with your team.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-card border-2 border-brand bg-surface px-5 py-3.5 text-center shadow-sm transition-colors hover:bg-brand-soft"
            >
              <span className="mx-auto grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
                <NyayOpsMark size={28} />
              </span>
              <p className="mt-2 font-display text-base font-semibold text-brand">Sign in</p>
              <p className="mt-0.5 text-xs text-ink-muted">Access your existing workspace</p>
            </button>

            <button
              type="button"
              onClick={onCreateAccount}
              className="rounded-card border border-border bg-surface px-5 py-3.5 text-center shadow-sm transition-colors hover:border-brand-strong hover:bg-surface-muted"
            >
              <span className="mx-auto grid size-9 place-items-center rounded-full bg-surface-muted text-ink">
                <NyayOpsMark size={28} />
              </span>
              <p className="mt-2 font-display text-base font-semibold text-ink">Create account</p>
              <p className="mt-0.5 text-xs text-ink-muted">Set up a new firm workspace</p>
            </button>
          </div>
        </div>

        <div className="relative mt-4 shrink-0">
          <div className="absolute inset-x-[-15%] bottom-0 h-24 rounded-t-[50%] bg-shell" aria-hidden />
          <div className="relative flex flex-col items-center gap-2 px-6 pt-8 pb-6">
            <button
              type="button"
              onClick={onAskAi}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-pop transition-colors hover:bg-brand-strong"
            >
              <NyayOpsMark size={28} /> Ask NyayOps AI <ChevronRight className="size-4" />
            </button>
            <p className="text-xs text-shell-ink-muted">Powered by legal intelligence</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [searchParams] = useSearchParams()
  // Landing's CTAs (Talk to NyayOps / Get started) link here with ?start=details
  // to skip the sign-in/create-account chooser - direct visits to /register still
  // see it. ?mode=chat additionally opens straight into BootstrapChat.
  const [mode, setMode] = useState<'form' | 'chat'>(
    searchParams.get('mode') === 'chat' ? 'chat' : 'form',
  )
  const [step, setStep] = useState<'welcome' | 'details' | 'otp'>(
    searchParams.get('start') === 'details' ? 'details' : 'welcome',
  )
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
        await setSession(res)
        navigate('/setup', { replace: true })
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
      await setSession(res)
      navigate('/setup', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired verification code.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'welcome') {
    return (
      <WelcomeStep
        onSignIn={() => navigate('/login')}
        onCreateAccount={() => {
          setMode('form')
          setStep('details')
        }}
        onAskAi={() => {
          setMode('chat')
          setStep('details')
        }}
      />
    )
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
      <button
        onClick={() => setStep('welcome')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back
      </button>
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

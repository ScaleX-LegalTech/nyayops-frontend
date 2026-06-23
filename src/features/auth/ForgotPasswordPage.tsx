import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { forgotPassword } from '@/lib/api/auth'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { AuthLayout } from './AuthLayout'

export default function ForgotPasswordPage() {
  const [tenantSlug, setTenantSlug] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email, tenantSlug)
    } finally {
      // Always show the same generic confirmation, regardless of outcome -
      // the backend never reveals whether an account exists.
      setLoading(false)
      setDone(true)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
            <MailCheck className="size-7" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-ink-muted">
            If an account exists for that email, a reset link has been sent.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block text-sm font-medium text-brand hover:text-brand-strong"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Forgot your password?
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          We'll email you a link to set a new one.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
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
        <Button type="submit" size="lg" loading={loading} className="w-full justify-center">
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link to="/login" className="font-medium text-brand hover:text-brand-strong">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

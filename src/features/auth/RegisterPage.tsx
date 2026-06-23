import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { registerTenant } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { AuthLayout } from './AuthLayout'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [doneSlug, setDoneSlug] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await registerTenant({
        organization_name: orgName,
        organization_slug: slug,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: password,
      })
      setDoneSlug(res.tenant_slug)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  if (doneSlug) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-ink">Organization created</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your workspace slug is{' '}
            <span className="font-mono font-medium text-ink">{doneSlug}</span>. Use it with your
            admin email to sign in.
          </p>
          <Button size="lg" className="mt-6 w-full justify-center" onClick={() => navigate('/login')}>
            Continue to sign in
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Register your firm
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Create a workspace and its first administrator.
        </p>
      </div>
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
          <Input
            id="pw"
            type="password"
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
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have a workspace?{' '}
        <Link to="/login" className="font-medium text-brand hover:text-brand-strong">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

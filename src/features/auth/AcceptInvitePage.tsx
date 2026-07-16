import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { acceptInvite } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Field, PasswordInput } from '@/components/ui/Field'
import { AuthLayout } from './AuthLayout'

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await acceptInvite(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to accept this invite.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-ink">Account activated</h1>
          <p className="mt-2 text-sm text-ink-muted">Your password has been set. You can now sign in.</p>
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
          Set your password
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Choose a password to activate your NyayOps account.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" htmlFor="password" hint="At least 10 characters.">
          <PasswordInput
            id="password"
            autoFocus
            autoComplete="new-password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            required
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword">
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={10}
            required
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={loading} className="w-full justify-center">
          Activate account
        </Button>
      </form>
    </AuthLayout>
  )
}

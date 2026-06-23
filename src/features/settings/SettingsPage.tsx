import { useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2, Copy, ShieldCheck } from 'lucide-react'
import { enrollMfa, verifyMfa } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAuth } from '@/auth/AuthContext'

type Stage = 'idle' | 'enrolling' | 'verifying' | 'enabled'

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [stage, setStage] = useState<Stage>('idle')
  const [secret, setSecret] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function startEnrollment() {
    setError(null)
    setBusy(true)
    try {
      const res = await enrollMfa()
      setSecret(res.secret)
      setQrDataUrl(await QRCode.toDataURL(res.otp_uri, { margin: 1, width: 200 }))
      setStage('verifying')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start enrollment.')
    } finally {
      setBusy(false)
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await verifyMfa(code)
      setStage('enabled')
      toast('Two-step verification enabled.', 'success')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Security"
        description="Manage two-step verification for your account."
      />

      <div className="grid max-w-2xl gap-5">
        <Card>
          <CardHeader
            title="Account"
            description={user?.email ?? undefined}
            action={
              user?.is_org_admin ? (
                <span className="text-xs font-medium text-brand">Organization admin</span>
              ) : null
            }
          />
        </Card>

        <Card>
          <CardHeader
            title="Two-step verification"
            description="Add a time-based one-time code (TOTP) to your sign-in."
            action={
              <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
                <ShieldCheck className="size-5" />
              </span>
            }
          />
          <CardBody className="border-t border-border">
            {stage === 'idle' && (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-ink-muted">
                  When enabled, signing in asks for a 6-digit code from your authenticator app as a
                  second step — after your password is verified.
                </p>
                <Button onClick={startEnrollment} loading={busy}>
                  Enable two-step verification
                </Button>
              </div>
            )}

            {stage === 'verifying' && (
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="shrink-0">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="MFA QR code"
                      className="rounded-card border border-border"
                      width={200}
                      height={200}
                    />
                  )}
                </div>
                <div className="flex-1 space-y-4">
                  <ol className="list-decimal space-y-1 pl-4 text-sm text-ink-muted">
                    <li>Scan the QR code with Google Authenticator, Authy, or 1Password.</li>
                    <li>Or enter the secret key manually.</li>
                    <li>Enter the 6-digit code it shows to confirm.</li>
                  </ol>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(secret)
                      toast('Secret copied.', 'info')
                    }}
                    className="inline-flex items-center gap-2 rounded-control border border-border bg-surface-muted px-3 py-1.5 font-mono text-sm text-ink hover:bg-surface"
                  >
                    {secret}
                    <Copy className="size-3.5 text-ink-muted" />
                  </button>
                  <form onSubmit={confirm} className="space-y-3">
                    <Field label="Verification code" htmlFor="mfaCode" error={error ?? undefined}>
                      <Input
                        id="mfaCode"
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        className="max-w-40 text-center font-mono tracking-[0.3em]"
                      />
                    </Field>
                    <Button type="submit" loading={busy}>
                      Confirm & enable
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {stage === 'enabled' && (
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-success-soft text-success">
                  <CheckCircle2 className="size-6" />
                </span>
                <div>
                  <p className="font-medium text-ink">Two-step verification is on.</p>
                  <p className="text-sm text-ink-muted">
                    You'll be asked for a code next time you sign in.
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

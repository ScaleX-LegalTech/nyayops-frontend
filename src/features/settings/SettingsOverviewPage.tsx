import { useEffect, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { Bell, CheckCircle2, Copy, Lock, ShieldCheck, Unlock } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { enrollMfa, verifyMfa } from '@/lib/api/auth'
import { getMe, updateMe } from '@/lib/api/profile'
import { getOrganization, setOrganizationFreeze } from '@/lib/api/organization'
import { freezeBranch, getBranch } from '@/lib/api/admin'
import { ApiError } from '@/lib/api/client'
import { qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSubscriptionState,
  isPushSupported,
} from '@/lib/push'
import { useToast } from '@/components/ui/Toast'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { useAuth } from '@/auth/AuthContext'

type Stage = 'idle' | 'enrolling' | 'verifying' | 'enabled'

function ProfileCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({ queryKey: qk.myProfile, queryFn: getMe })

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name)
    setPhone(profile.phone ?? '')
    setBio(profile.bio ?? '')
  }, [profile])

  const mutation = useMutationWithToast({
    mutationFn: () =>
      updateMe({ full_name: fullName.trim(), phone: phone.trim() || null, bio: bio.trim() || null }),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.myProfile, updated)
      toast('Profile updated.', 'success')
    },
    errorFallback: 'Could not update profile.',
  })

  if (isLoading || !profile) {
    return (
      <Card>
        <CardHeader title="Profile" description="Loading…" />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Profile"
        description={profile.email}
        action={
          user?.is_org_admin ? (
            <span className="text-xs font-medium text-brand">Organization admin</span>
          ) : null
        }
      />
      <CardBody className="border-t border-border">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (fullName.trim()) mutation.mutate()
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required htmlFor="profile-name">
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </Field>
            <Field label="Phone" htmlFor="profile-phone" hint="Optional.">
              <Input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Field label="Bio" htmlFor="profile-bio" hint="Optional — visible to your organization.">
            <Textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A short line about yourself…"
            />
          </Field>
          <Button type="submit" loading={mutation.isPending} disabled={!fullName.trim()}>
            Save
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

function EmailNotificationsCard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: profile } = useQuery({ queryKey: qk.myProfile, queryFn: getMe })

  const mutation = useMutationWithToast({
    mutationFn: (enabled: boolean) => updateMe({ email_notifications_enabled: enabled }),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.myProfile, updated)
      toast(
        updated.email_notifications_enabled
          ? 'Email notifications enabled.'
          : 'Email notifications disabled.',
        'success',
      )
    },
    errorFallback: 'Could not update email notification preference.',
  })

  if (!profile) return null
  const enabled = profile.email_notifications_enabled

  return (
    <Card>
      <CardHeader
        title="Email notifications"
        description={
          enabled
            ? 'You’ll get case reassignments, mentions, and hearing reminders by email too.'
            : 'Off by default — account emails (OTP, password reset, invitations) always send regardless of this setting.'
        }
        action={
          <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
            <Bell className="size-5" />
          </span>
        }
      />
      <CardBody className="border-t border-border">
        <Button
          variant={enabled ? 'secondary' : 'primary'}
          loading={mutation.isPending}
          onClick={() => mutation.mutate(!enabled)}
        >
          {enabled ? 'Disable email notifications' : 'Enable email notifications'}
        </Button>
      </CardBody>
    </Card>
  )
}

function PushNotificationsCard() {
  const { toast } = useToast()
  const [state, setState] = useState<'unsupported' | 'subscribed' | 'unsubscribed' | 'loading'>(
    'loading',
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPushSubscriptionState().then(setState)
  }, [])

  async function toggle() {
    setBusy(true)
    try {
      if (state === 'subscribed') {
        await disablePushNotifications()
        setState('unsubscribed')
        toast('Browser push notifications turned off.', 'success')
      } else {
        await enablePushNotifications()
        setState('subscribed')
        toast('Browser push notifications enabled.', 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update push notifications.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!isPushSupported()) return null

  return (
    <Card>
      <CardHeader
        title="Push notifications"
        description={
          state === 'subscribed'
            ? 'This browser will receive notifications even when NyayOps is closed.'
            : 'Get case reassignments, mentions, and hearing reminders as browser notifications.'
        }
        action={
          <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
            <Bell className="size-5" />
          </span>
        }
      />
      <CardBody className="border-t border-border">
        <Button
          variant={state === 'subscribed' ? 'secondary' : 'primary'}
          loading={busy || state === 'loading'}
          onClick={toggle}
        >
          {state === 'subscribed' ? 'Disable push notifications' : 'Enable push notifications'}
        </Button>
      </CardBody>
    </Card>
  )
}

function OrganizationFreezeCard() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: org } = useQuery({ queryKey: qk.organization, queryFn: getOrganization })

  const mutation = useMutationWithToast({
    mutationFn: (isFrozen: boolean) => setOrganizationFreeze(isFrozen),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.organization, updated)
      // AppShell's paused-org banner reads a separate query (qk.organizationName,
      // shared with the sidebar) - invalidate it too so the banner clears immediately
      // instead of waiting for its own refetchInterval.
      void queryClient.invalidateQueries({ queryKey: qk.organizationName })
      toast(
        updated.is_frozen
          ? 'Organization frozen — every write is blocked until you unfreeze it.'
          : 'Organization unfrozen.',
        'success',
      )
    },
    errorFallback: 'Could not update freeze status.',
  })

  if (!org) return null

  // Platform staff froze this, not the org itself (e.g. non-payment) - only they can
  // lift it, so don't offer a self-unfreeze button that would just 403.
  const lockedByPlatform = org.is_frozen && org.frozen_by === 'platform_admin'

  return (
    <Card
      style={
        org.is_frozen
          ? { borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-danger-soft)' }
          : undefined
      }
    >
      <CardHeader
        title="Organization freeze"
        description={
          lockedByPlatform
            ? 'Paused by NyayOps staff, not by your team - resolve the issue that caused it (e.g. an outstanding payment) and contact support to have it lifted.'
            : org.is_frozen
              ? 'Read-only for everyone, including you, until you unfreeze it.'
              : 'A last-resort lockdown — e.g. a billing dispute or suspected compromise.'
        }
        action={
          <span className="grid size-9 place-items-center rounded-control bg-danger-soft text-danger">
            {org.is_frozen ? <Lock className="size-5" /> : <Unlock className="size-5" />}
          </span>
        }
      />
      <CardBody className="border-t border-border">
        <Button
          variant={org.is_frozen ? 'secondary' : 'danger'}
          loading={mutation.isPending}
          disabled={lockedByPlatform}
          onClick={() => mutation.mutate(!org.is_frozen)}
        >
          {org.is_frozen ? 'Unfreeze organization' : 'Freeze organization'}
        </Button>
      </CardBody>
    </Card>
  )
}

function BranchFreezeCard({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: branch } = useQuery({
    queryKey: qk.branchDetail(branchId),
    queryFn: () => getBranch(branchId),
  })

  const mutation = useMutationWithToast({
    mutationFn: (isFrozen: boolean) => freezeBranch(branchId, isFrozen),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.branchDetail(branchId), updated)
      toast(updated.is_frozen ? 'Branch frozen — read-only.' : 'Branch unfrozen.', 'success')
    },
    errorFallback: 'Could not update freeze status.',
  })

  if (!branch) return null

  return (
    <Card
      style={
        branch.is_frozen
          ? { borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-danger-soft)' }
          : undefined
      }
    >
      <CardHeader
        title={`${branch.name} — freeze`}
        description={
          branch.is_frozen
            ? 'Read-only for your branch until you unfreeze it.'
            : 'Pause your branch’s day-to-day writes, e.g. during a handover.'
        }
        action={
          <span className="grid size-9 place-items-center rounded-control bg-danger-soft text-danger">
            {branch.is_frozen ? <Lock className="size-5" /> : <Unlock className="size-5" />}
          </span>
        }
      />
      <CardBody className="border-t border-border">
        <Button
          variant={branch.is_frozen ? 'secondary' : 'danger'}
          loading={mutation.isPending}
          onClick={() => mutation.mutate(!branch.is_frozen)}
        >
          {branch.is_frozen ? 'Unfreeze branch' : 'Freeze branch'}
        </Button>
      </CardBody>
    </Card>
  )
}

export default function SettingsOverviewPage() {
  const { toast } = useToast()
  const { user, isManagingDirector, isBranchAdmin } = useAuth()
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
    <div className="grid max-w-2xl gap-5">
      <ProfileCard />

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

      <EmailNotificationsCard />
      <PushNotificationsCard />

      {isManagingDirector && <OrganizationFreezeCard />}
      {isBranchAdmin && !isManagingDirector && user?.bid && <BranchFreezeCard branchId={user.bid} />}
    </div>
  )
}

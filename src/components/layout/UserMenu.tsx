import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut, Settings, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PersonAvatar } from '@/components/ui/Avatar'
import { displayName } from '@/lib/formatName'
import { getMe } from '@/lib/api/profile'
import { qk } from '@/lib/queryKeys'

export function UserMenu() {
  const { user, logout } = useAuth()
  const { data: profile } = useQuery({ queryKey: qk.myProfile, queryFn: getMe })
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const name = profile ? displayName(profile) : user?.email ?? 'Unknown user'
  const email = user?.email ?? ''

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-control py-1 pl-1 pr-2 hover:bg-surface-muted"
      >
        <PersonAvatar label={name} />
        <span className="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">
          {name}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-card border border-border bg-surface shadow-pop animate-rise"
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-ink-muted">{email}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
              {user?.is_org_admin ? (
                <>
                  <ShieldCheck className="size-3.5 text-brand" /> Organization admin
                </>
              ) : (
                'Team member'
              )}
            </p>
          </div>
          <button
            onClick={() => {
              setOpen(false)
              navigate('/settings')
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-surface-muted"
          >
            <Settings className="size-4 text-ink-muted" />
            Profile & security
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 border-t border-border px-4 py-2.5 text-sm text-danger hover:bg-danger-soft"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

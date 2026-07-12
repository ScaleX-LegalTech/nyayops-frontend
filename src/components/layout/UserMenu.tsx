import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { initials } from '@/lib/format'

export function UserMenu() {
  const { user, logout } = useAuth()
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

  const email = user?.email ?? 'Unknown user'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-control py-1 pl-1 pr-2 hover:bg-surface-muted"
      >
        <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
          {initials(email)}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">
          {email}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-card border border-border bg-surface shadow-pop animate-rise"
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{email}</p>
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

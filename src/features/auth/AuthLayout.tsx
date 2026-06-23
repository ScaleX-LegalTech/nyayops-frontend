import type { ReactNode } from 'react'
import { Scale } from 'lucide-react'

/** Split-screen auth shell: branded ink panel + form column. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-shell p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-control bg-accent/15 text-accent">
            <Scale className="size-6" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">
            Nyay<span className="text-accent">Ops</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white">
            The operating system for legal casework.
          </h2>
          <p className="mt-4 text-white/60">
            Track every matter through review, manage versioned documents, and keep an
            audited record of who did what — all in one calm, deliberate workspace.
          </p>
        </div>

        <p className="relative text-sm text-white/40">
          Secured with role-based access and optional two-step verification.
        </p>
      </aside>

      <main className="flex items-center justify-center bg-bg px-5 py-10">
        <div className="w-full max-w-sm animate-rise">{children}</div>
      </main>
    </div>
  )
}

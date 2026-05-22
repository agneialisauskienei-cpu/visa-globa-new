import type { ReactNode } from "react"

export function VgShell({ children }: { children: ReactNode }) {
  return <section className="vg-shell">{children}</section>
}

export function VgHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="vg-header">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="vg-eyebrow">{eyebrow}</p>
          <h1 className="vg-title">{title}</h1>
          {subtitle ? <p className="vg-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export function VgCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`vg-card ${className}`}>{children}</section>
}

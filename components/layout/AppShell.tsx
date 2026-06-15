'use client'

import type { ReactNode } from 'react'
import AppSidebar from '@/components/layout/AppSidebar'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={styles.shell}>
      <AppSidebar />

      <main style={styles.main}>
        <div style={styles.content}>{children}</div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '270px 1fr',
    background: '#ffffff',
  },
  main: {
    minWidth: 0,
    padding: '24px 28px',
    boxSizing: 'border-box',
  },
  content: {
    width: '100%',
    maxWidth: 1220,
    margin: '0 auto',
  },
}

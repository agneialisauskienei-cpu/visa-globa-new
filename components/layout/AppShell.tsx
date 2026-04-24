'use client'

import type { ReactNode } from 'react'
import Sidebar from '@/components/navigation/Sidebar'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={styles.shell}>
      <Sidebar />

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
    background: '#f8fafc',
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
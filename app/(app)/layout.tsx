'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { NotificationProvider } from '@/components/providers/NotificationProvider'
import Sidebar from '@/components/navigation/Sidebar'

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const checkScreen = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    checkScreen()
    window.addEventListener('resize', checkScreen)

    return () => {
      window.removeEventListener('resize', checkScreen)
    }
  }, [])

  return (
    <NotificationProvider>
      <div
        style={{
          minHeight: '100vh',
          background: '#f8fafc',
          display: isDesktop ? 'grid' : 'block',
          gridTemplateColumns: isDesktop ? '300px minmax(0, 1fr)' : undefined,
        }}
      >
        {isDesktop ? (
          <aside
            style={{
              minHeight: '100vh',
              position: 'sticky',
              top: 0,
              alignSelf: 'start',
            }}
          >
            <Sidebar />
          </aside>
        ) : null}

        <main
          style={{
            minWidth: 0,
            width: '100%',
            overflowX: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
    </NotificationProvider>
  )
}
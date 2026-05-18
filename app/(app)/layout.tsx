"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { NotificationProvider } from "@/components/providers/NotificationProvider"
import AppSidebar from "@/components/layout/AppSidebar"

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    function update() {
      setIsDesktop(window.innerWidth >= 1024)
    }

    update()
    window.addEventListener("resize", update)

    return () => window.removeEventListener("resize", update)
  }, [])

  return (
    <NotificationProvider>
      <div style={styles.shell}>
        {isDesktop ? <AppSidebar /> : null}

        <main style={styles.main}>
          <div style={styles.content}>{children}</div>
        </main>
      </div>
    </NotificationProvider>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    background: "#f8fafc",
  },
  main: {
    flex: 1,
    minWidth: 0,
    padding: "24px 28px",
    boxSizing: "border-box",
  },
  content: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    margin: "0 auto",
  },
}
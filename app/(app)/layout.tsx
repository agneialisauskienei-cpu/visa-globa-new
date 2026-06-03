"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { NotificationProvider } from "@/components/providers/NotificationProvider"
import AppSidebar from "@/components/layout/AppSidebar"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLayoutShell embedded={false}>Kraunama...</AppLayoutShell>}>
      <AppLayoutContent>{children}</AppLayoutContent>
    </Suspense>
  )
}

function AppLayoutContent({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false)
  const searchParams = useSearchParams()
  const embedded = searchParams.get("embedded") === "1"

  useEffect(() => {
    function update() {
      setIsDesktop(window.innerWidth >= 1024)
    }

    update()
    window.addEventListener("resize", update)

    return () => window.removeEventListener("resize", update)
  }, [])

  return (
    <AppLayoutShell embedded={embedded} showSidebar={isDesktop && !embedded}>
      {children}
    </AppLayoutShell>
  )
}

function AppLayoutShell({
  children,
  embedded,
  showSidebar = false,
}: {
  children: ReactNode
  embedded: boolean
  showSidebar?: boolean
}) {
  return (
    <NotificationProvider>
      <div style={styles.shell}>
        {showSidebar ? <AppSidebar /> : null}

        <main style={embedded ? styles.embeddedMain : styles.main}>
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
  embeddedMain: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    boxSizing: "border-box",
  },
  content: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    margin: "0 auto",
  },
}

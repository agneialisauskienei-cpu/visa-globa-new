"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "next/navigation"
import { NotificationProvider } from "@/components/providers/NotificationProvider"
import AppSidebar from "@/components/layout/AppSidebar"
import PageInstructions from "@/components/layout/PageInstructions"
import { getCurrentAccess, hasModuleAccess } from "@/lib/app-access"
import { moduleForPath } from "@/lib/plans"

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
    <ModuleAccessGuard>
      <AppLayoutShell embedded={embedded} showSidebar={isDesktop && !embedded}>
        {children}
      </AppLayoutShell>
    </ModuleAccessGuard>
  )
}

function ModuleAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checkedPath, setCheckedPath] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function checkAccess() {
      const moduleKey = moduleForPath(pathname)
      if (!moduleKey) {
        if (active) setCheckedPath(pathname)
        return
      }

      const access = await getCurrentAccess()
      if (!active) return

      if (!access.role) {
        router.replace("/login")
        return
      }

      if (!hasModuleAccess(access, moduleKey)) {
        router.replace(`/module-unavailable?module=${encodeURIComponent(moduleKey)}`)
        return
      }

      setCheckedPath(pathname)
    }

    void checkAccess()
    return () => {
      active = false
    }
  }, [pathname, router])

  if (checkedPath !== pathname) {
    return <AppLayoutShell embedded={false}>Tikrinama prieiga...</AppLayoutShell>
  }

  return children
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
      <div className="vg-app-shell" style={styles.shell}>
        {showSidebar ? <AppSidebar /> : null}

        <main style={embedded ? styles.embeddedMain : styles.main}>
          <div style={styles.content}>{children}</div>
        </main>
        {!embedded ? <PageInstructions /> : null}
      </div>
    </NotificationProvider>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    background: "#ffffff",
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

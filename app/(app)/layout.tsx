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
import { supabase } from "@/lib/supabase"
import { setStoredOrganizationId } from "@/lib/current-organization"
import { reportSystemIncident } from "@/lib/system-incidents"

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
  const [accessError, setAccessError] = useState(false)

  useEffect(() => {
    let active = true

    async function checkAccess() {
      try {
        setAccessError(false)

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
      } catch (error) {
        console.error("Access check failed:", error)
        if (active) {
          reportSystemIncident({
            type: "access_check_failed",
            source: "app-layout",
            path: pathname,
          })
          setAccessError(true)
        }
      }
    }

    void checkAccess()
    return () => {
      active = false
    }
  }, [pathname, router])

  if (accessError) {
    return <AccessCheckFailed />
  }

  if (checkedPath !== pathname) {
    return <AppLayoutShell embedded={false}>Tikrinama prieiga...</AppLayoutShell>
  }

  return children
}

function AccessCheckFailed() {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  async function goToLogin() {
    setLeaving(true)
    setStoredOrganizationId(null)
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Sign out failed after access check error:", error)
    } finally {
      router.replace("/login")
    }
  }

  return (
    <AppLayoutShell embedded={false}>
      <div className="mx-auto mt-16 max-w-xl rounded-[24px] border border-[#c9d8d0] bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#486b5d]">
          Prisijungimas
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[#10231c]">
          Nepavyko patikrinti prieigos
        </h1>
        <p className="mt-3 text-base leading-7 text-[#486b5d]">
          Sesija galėjo nutrūkti arba ryšys trumpam sutriko. Prisijunk iš naujo ir tęsk darbą.
        </p>
        <button
          type="button"
          onClick={goToLogin}
          disabled={leaving}
          className="mt-6 rounded-[14px] bg-[#486b5d] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#39594c] disabled:opacity-60"
        >
          {leaving ? "Atsijungiama..." : "Grįžti į prisijungimą"}
        </button>
      </div>
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
      <div className="vg-app-shell" style={styles.shell}>
        {showSidebar ? <AppSidebar /> : null}

        <main style={embedded ? styles.embeddedMain : styles.main}>
          {!embedded ? (
            <div className="vg-page-toolbar">
              <PageInstructions />
            </div>
          ) : null}
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

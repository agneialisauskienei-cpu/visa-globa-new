"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import {
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Inbox,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  UserRound,
  Users,
} from "lucide-react"

import VisaGlobaLogo from "@/components/brand/VisaGlobaLogo"
import {
  getCurrentAccess,
  hasModuleAccess,
  hasPermission,
  roleLabel,
  staffTypeLabel,
  type CurrentAccess,
} from "@/lib/app-access"
import { ADMIN_MENU, EMPLOYEE_MENU, type AppMenuItem } from "@/lib/app-menu"
import { supabase } from "@/lib/supabase"

const SUPER_ADMIN_MENU: AppMenuItem[] = [
  {
    label: "Pagrindinis",
    href: "/admin",
    permission: "settings.manage",
    icon: "home",
  },
  {
    label: "Nustatymai",
    href: "/settings",
    permission: "settings.manage",
    icon: "settings",
  },
]

function menuIcon(icon: string) {
  if (icon === "home") return Home
  if (icon === "home2") return Home
  if (icon === "users") return Users
  if (icon === "user") return UserRound
  if (icon === "resident") return User
  if (icon === "tasks") return ClipboardList
  if (icon === "heart") return HeartPulse
  if (icon === "box") return Box
  if (icon === "clipboard") return FileText
  if (icon === "inbox") return Inbox
  if (icon === "chart") return BarChart3
  if (icon === "bell") return Bell
  if (icon === "calendar") return CalendarDays
  if (icon === "settings") return Settings
  if (icon === "shield") return ShieldCheck

  return Home
}

function isActiveItem(
  item: AppMenuItem,
  pathname: string,
  searchParams: URLSearchParams,
) {
  const [itemPath, itemQuery] = item.href.split("?")

  if (pathname !== itemPath) return false
  if (!itemQuery) return true

  const params = new URLSearchParams(itemQuery)

  for (const [key, value] of params.entries()) {
    if (searchParams.get(key) !== value) return false
  }

  return true
}

function initials(nameOrEmail: string | null | undefined) {
  const value = (nameOrEmail || "NA").trim()
  const parts = value.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase()
  }

  return value.slice(0, 2).toUpperCase()
}

export default function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [access, setAccess] = useState<CurrentAccess | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string>("")

  async function loadAccess() {
    const current = await getCurrentAccess()
    setAccess(current)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url, full_name, first_name, last_name, email")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
        console.error("[AppSidebar] profile load failed", error)
      }

      const avatar = typeof data?.avatar_url === "string" && data.avatar_url.trim()
        ? data.avatar_url.trim()
        : null

      setAvatarUrl(avatar)

      const name =
        data?.full_name ||
        [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
        data?.email ||
        current.email ||
        "Naudotojas"

      setProfileName(name)
    } else {
      setProfileName(current.email || "Naudotojas")
      setAvatarUrl(null)
    }
  }

  useEffect(() => {
    void loadAccess()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const brandHref =
    access?.role === "super_admin"
      ? "/admin"
      : access?.role === "employee"
        ? "/employee-dashboard"
        : "/dashboard"

  const visibleMenu = useMemo(() => {
    if (!access) return []

    if (access.role === "super_admin") {
      return SUPER_ADMIN_MENU.filter((item) =>
        hasPermission(access, item.permission),
      )
    }

    if (access.role === "employee") {
      return EMPLOYEE_MENU.filter((item) =>
        hasPermission(access, item.permission) &&
        hasModuleAccess(access, item.moduleKey),
      )
    }

    return ADMIN_MENU.filter((item) =>
      hasPermission(access, item.permission) &&
      hasModuleAccess(access, item.moduleKey),
    )
  }, [access])

  const userRoleLabel =
    access?.role === "employee"
      ? staffTypeLabel(access.staffType)
      : roleLabel(access?.role)

  const displayName = profileName || access?.email || "Naudotojas"
  const displayEmail = (access?.email || "").split("@")[0]

  return (
    <aside style={styles.sidebar}>
      <div style={styles.top}>
        <Link href={brandHref} style={styles.brandBlock}>
          <div style={styles.logoIcon}>
            <VisaGlobaLogo title="" />
          </div>

          <div style={styles.brand}>VisaGloba</div>
        </Link>

        <nav style={styles.nav}>
          {visibleMenu.map((item) => {
            const Icon = menuIcon(item.icon)
            const active = isActiveItem(item, pathname, searchParams)

            return (
              <Link
                key={`${item.href}-${item.permission}`}
                href={item.href}
                className={active ? "vg-sidebar-link-active" : "vg-sidebar-link"}
                style={active ? styles.linkActive : styles.link}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div style={styles.footer}>
        <div style={styles.userBox}>
          <div style={styles.avatar}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "50%",
                  display: "block",
                }}
              />
            ) : (
              initials(displayName)
            )}
          </div>

          <div style={styles.userInfo}>
            <div style={styles.userName}>{profileName || "Naudotojas"}</div>
            {displayEmail ? <div style={styles.userEmail}>{displayEmail}</div> : null}
            <div style={styles.userRole}>{userRoleLabel}</div>
          </div>
        </div>

        <button type="button" style={styles.logout} onClick={() => void logout()}>
          <LogOut size={17} />
          Atsijungti
        </button>
      </div>
    </aside>
  )
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    width: 254,
    minWidth: 254,
    height: "100vh",
    position: "sticky",
    top: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 18,
    boxSizing: "border-box",
    background:
      "linear-gradient(180deg, #022c22 0%, #064e3b 45%, #022c22 100%)",
    color: "#ffffff",
    borderRight: "1px solid rgba(255,255,255,.08)",
  },

  top: {
    minHeight: 0,
    display: "grid",
    gap: 24,
  },

  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "2px 2px 8px",
    color: "#ffffff",
    textDecoration: "none",
  },

  logoIcon: {
    width: 38,
    height: 38,
    minWidth: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  brand: {
    fontSize: 22,
    fontWeight: 950,
    lineHeight: 1,
    letterSpacing: "-.03em",
  },

  nav: {
    display: "grid",
    gap: 5,
    overflowY: "auto",
    paddingRight: 2,
  },

  link: {
    minHeight: 40,
    borderRadius: 14,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
    transition: "all .18s ease",
  },

  linkActive: {
    minHeight: 40,
    borderRadius: 14,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#022c22",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,.12)",
  },

  footer: {
    display: "grid",
    gap: 10,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,.12)",
  },

  userBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    padding: "8px 10px",
    background: "rgba(255,255,255,.07)",
    minWidth: 0,
  },

  avatar: {
    width: 42,
    height: 42,
    minWidth: 42,
    borderRadius: "50%",
    overflow: "hidden",
    background: "rgba(255,255,255,.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 900,
    fontSize: 13,
  },

  userInfo: {
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
  },

  userName: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 1.2,
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  userEmail: {
    marginTop: 2,
    color: "rgba(255,255,255,.72)",
    fontSize: 11,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  userRole: {
    marginTop: 2,
    color: "#a7f3d0",
    fontSize: 11,
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  logout: {
    width: "100%",
    height: 44,
    border: "none",
    borderRadius: 14,
    background: "#ef4444",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
}

"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import {
  BarChart3,
  Box,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Inbox,
  LogOut,
  ShieldCheck,
  User,
  UserRound,
  Users,
} from "lucide-react"

import {
  getCurrentAccess,
  hasPermission,
  roleLabel,
  staffTypeLabel,
  type CurrentAccess,
} from "@/lib/app-access"
import { APP_MENU, type AppMenuItem } from "@/lib/app-menu"
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
  if (icon === "shield") return ShieldCheck

  return Home
}

function isActiveItem(
  item: AppMenuItem,
  pathname: string,
  searchParams: URLSearchParams
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

function mapMenuByRole(item: AppMenuItem, access: CurrentAccess): AppMenuItem {
  if (
    item.label === "Gyventojai" &&
    item.href === "/residents" &&
    access.role === "employee"
  ) {
    return {
      ...item,
      href: "/my-residents",
      label: "Mano gyventojai",
    }
  }

  return item
}

function initials(nameOrEmail: string | null | undefined) {
  const value = (nameOrEmail || "NA").trim()
  const parts = value.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase()
  }

  return value.slice(0, 2).toUpperCase()
}

function VisaGlobaLogo() {
  return (
    <svg
      width="31"
      height="31"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M20 33.5C18.8 32.4 16.2 30.2 13.1 27.7C8 23.6 4.5 20 4.5 14.7C4.5 10.5 7.7 7.2 11.8 7.2C14.4 7.2 16.7 8.5 18.2 10.5L20 12.9L21.8 10.5C23.3 8.5 25.6 7.2 28.2 7.2C32.3 7.2 35.5 10.5 35.5 14.7C35.5 20 32 23.6 26.9 27.7C23.8 30.2 21.2 32.4 20 33.5Z"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.4 17.5L16.4 13.6C17.5 12.5 19.2 12.5 20.3 13.6L22 15.2"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27.6 17.5L23.6 13.6C22.5 12.5 20.8 12.5 19.7 13.6L18 15.2"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.6 20.2L18.4 23.8C19.3 24.7 20.7 24.7 21.6 23.8L25.4 20.2"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [access, setAccess] = useState<CurrentAccess | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string>("")

  useEffect(() => {
    void loadAccess()
  }, [])

  async function loadAccess() {
    const current = await getCurrentAccess()
    setAccess(current)

    if (current?.userId) {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name, first_name, last_name, email")
        .eq("id", current.userId)
        .maybeSingle()

      setAvatarUrl(data?.avatar_url || null)

      const name =
        data?.full_name ||
        [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
        data?.email ||
        current.email ||
        "Naudotojas"

      setProfileName(name)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const brandHref = access?.role === "super_admin" ? "/admin" : "/dashboard"

  const visibleMenu = useMemo(() => {
    if (!access) return []

    if (access.role === "super_admin") {
      return SUPER_ADMIN_MENU.filter((item) =>
        hasPermission(access, item.permission)
      )
    }

    return APP_MENU
      .filter((item) => hasPermission(access, item.permission))
      .map((item) => mapMenuByRole(item, access))
  }, [access])

  const userRoleLabel =
    access?.role === "employee"
      ? staffTypeLabel(access.staffType)
      : roleLabel(access?.role)

  const displayName = profileName || access?.email || "Naudotojas"

  return (
    <aside style={styles.sidebar}>
      <div style={styles.top}>
        <Link href={brandHref} style={styles.brandBlock}>
          <div style={styles.logoIcon}>
            <VisaGlobaLogo />
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
              <img src={avatarUrl} alt="Avatar" style={styles.avatarImage} />
            ) : (
              initials(displayName)
            )}
          </div>

          <div style={styles.userInfo}>
            <div style={styles.userName}>{displayName}</div>
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
    width: 34,
    height: 34,
    minWidth: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#86efac",
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
    borderRadius: 11,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#d1fae5",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
  },

  linkActive: {
    minHeight: 40,
    borderRadius: 11,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    background: "#15803d",
    boxShadow: "0 14px 34px rgba(22, 163, 74, .22)",
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
    borderRadius: 15,
    padding: "10px 12px",
    minWidth: 0,
    background: "rgba(255,255,255,.08)",
  },

  avatar: {
    width: 42,
    height: 42,
    minWidth: 42,
    borderRadius: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  userInfo: {
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
  },

  userName: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  userRole: {
    marginTop: 2,
    color: "#a7f3d0",
    fontSize: 11,
    fontWeight: 800,
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
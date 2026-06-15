import type { Permission } from "@/lib/app-access"
import type { ModuleKey } from "@/lib/plans"

export type AppMenuItem = {
  label: string
  href: string
  permission: Permission
  icon: string
  moduleKey?: ModuleKey
}

export const ADMIN_MENU: AppMenuItem[] = [
  {
    label: "Pagrindinis",
    href: "/dashboard",
    permission: "dashboard.view",
    icon: "home",
  },
  {
    label: "Darbuotojai",
    href: "/team",
    permission: "employees.view",
    icon: "users",
    moduleKey: "employees",
  },
  {
    label: "Užduotys",
    href: "/tasks",
    permission: "tasks.view",
    icon: "tasks",
    moduleKey: "tasks",
  },
  {
    label: "Mano profilis",
    href: "/my-profile",
    permission: "dashboard.view",
    icon: "user",
  },
  {
    label: "Gyventojai",
    href: "/residents",
    permission: "residents.view_basic",
    icon: "resident",
    moduleKey: "residents",
  },
  {
    label: "Veiklos",
    href: "/activities",
    permission: "activities.manage",
    icon: "tasks",
    moduleKey: "activities",
  },
  {
    label: "Medicina",
    href: "/medicine",
    permission: "medicine.view",
    icon: "heart",
    moduleKey: "medicine",
  },
  {
    label: "Kambariai",
    href: "/rooms",
    permission: "rooms.view",
    icon: "home2",
    moduleKey: "rooms",
  },
  {
    label: "Sandėliai",
    href: "/inventory",
    permission: "inventory.view",
    icon: "box",
    moduleKey: "inventory",
  },
  {
    label: "Perdavimo žurnalai",
    href: "/handover-logs",
    permission: "handover.view",
    icon: "clipboard",
    moduleKey: "handover",
  },
  {
    label: "Prašymai",
    href: "/team?tab=vacations",
    permission: "employees.manage",
    icon: "inbox",
    moduleKey: "employees",
  },
  {
    label: "Ataskaitos",
    href: "/reports",
    permission: "reports.view",
    icon: "chart",
    moduleKey: "reports",
  },
  {
    label: "Auditas",
    href: "/audit",
    permission: "audit.view",
    icon: "shield",
    moduleKey: "audit",
  },
]

export const EMPLOYEE_MENU: AppMenuItem[] = [
  {
    label: "Pagrindinis",
    href: "/employee-dashboard",
    permission: "dashboard.view",
    icon: "home",
  },
  {
    label: "Grafikas",
    href: "/my-schedule",
    permission: "dashboard.view",
    icon: "calendar",
  },
  {
    label: "Mano gyventojai",
    href: "/my-residents",
    permission: "residents.view_basic",
    icon: "resident",
    moduleKey: "residents",
  },
  {
    label: "Užduotys",
    href: "/tasks",
    permission: "tasks.view",
    icon: "tasks",
    moduleKey: "tasks",
  },
  {
    label: "Medicina",
    href: "/medicine",
    permission: "medicine.view",
    icon: "heart",
    moduleKey: "medicine",
  },
  {
    label: "Veiklos",
    href: "/activities",
    permission: "activities.manage",
    icon: "tasks",
    moduleKey: "activities",
  },
  {
    label: "Perdavimai",
    href: "/handover-logs",
    permission: "handover.view",
    icon: "clipboard",
    moduleKey: "handover",
  },
  {
    label: "Mano profilis",
    href: "/my-profile",
    permission: "dashboard.view",
    icon: "user",
  },
]

// Paliekama suderinamumui, jei kiti failai dar importuoja APP_MENU.
export const APP_MENU = ADMIN_MENU

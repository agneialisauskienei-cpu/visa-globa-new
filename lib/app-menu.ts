import type { Permission } from "@/lib/app-access"

export type AppMenuItem = {
  label: string
  href: string
  permission: Permission
  icon: string
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
  },
  {
    label: "Užduotys",
    href: "/tasks",
    permission: "tasks.view",
    icon: "tasks",
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
  },
  {
    label: "Veiklos",
    href: "/activities",
    permission: "activities.manage",
    icon: "tasks",
  },
  {
    label: "Medicina",
    href: "/medicine",
    permission: "medicine.view",
    icon: "heart",
  },
  {
    label: "Kambariai",
    href: "/rooms",
    permission: "rooms.view",
    icon: "home2",
  },
  {
    label: "Sandėliai",
    href: "/inventory",
    permission: "inventory.view",
    icon: "box",
  },
  {
    label: "Perdavimo žurnalai",
    href: "/handover-logs",
    permission: "handover.view",
    icon: "clipboard",
  },
  {
    label: "Prašymai",
    href: "/team?tab=vacations",
    permission: "employees.manage",
    icon: "inbox",
  },
  {
    label: "Ataskaitos",
    href: "/reports",
    permission: "reports.view",
    icon: "chart",
  },
  {
    label: "Auditas",
    href: "/audit",
    permission: "audit.view",
    icon: "shield",
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
  },
  {
    label: "Užduotys",
    href: "/tasks",
    permission: "tasks.view",
    icon: "tasks",
  },
  {
    label: "Medicina",
    href: "/medicine",
    permission: "medicine.view",
    icon: "heart",
  },
  {
    label: "Veiklos",
    href: "/activities",
    permission: "activities.manage",
    icon: "tasks",
  },
  {
    label: "Perdavimai",
    href: "/handover-logs",
    permission: "handover.view",
    icon: "clipboard",
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

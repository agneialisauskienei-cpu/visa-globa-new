import type { Permission } from "@/lib/app-access"

export type AppMenuItem = {
  label: string
  href: string
  permission: Permission
  icon: string
}

export const APP_MENU: AppMenuItem[] = [
  {
    label: "Pagrindinis",
    href: "/employee-dashboard",
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
    label: "Grafikas",
    href: "/my-schedule",
    permission: "schedule.view",
    icon: "calendar",
  },
  {
    label: "Pranešimai",
    href: "/notifications",
    permission: "notifications.view",
    icon: "bell",
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
    label: "Užklausos",
    href: "/requests",
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

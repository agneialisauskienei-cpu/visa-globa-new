import type { SystemRole } from '@/lib/app-access'

export type AppMenuItem = {
  label: string
  href: string
  roles: SystemRole[]
}

export const APP_MENU: AppMenuItem[] = [
  {
    label: 'Pagrindinis',
    href: '/dashboard',
    roles: ['owner', 'admin', 'employee'],
  },
  {
    label: 'Įstaigos',
    href: '/organizations',
    roles: ['owner'],
  },
  {
    label: 'Darbuotojai',
    href: '/employees',
    roles: ['owner', 'admin'],
  },
  {
    label: 'Gyventojai',
    href: '/residents',
    roles: ['owner', 'admin', 'employee'],
  },
  {
    label: 'Kambariai',
    href: '/rooms',
    roles: ['owner', 'admin', 'employee'],
  },
  {
    label: 'Sandėlis',
    href: '/inventory',
    roles: ['owner', 'admin', 'employee'],
  },
  {
    label: 'Užklausos',
    href: '/requests',
    roles: ['owner', 'admin', 'employee'],
  },
  {
    label: 'Kvietimai',
    href: '/invites',
    roles: ['owner', 'admin'],
  },
  {
    label: 'Ataskaitos',
    href: '/reports',
    roles: ['owner', 'admin'],
  },
  {
    label: 'Nustatymai',
    href: '/settings',
    roles: ['owner', 'admin'],
  },
]

export function getMenuForRole(role: SystemRole | null): AppMenuItem[] {
  if (!role) return []
  return APP_MENU.filter((item) => item.roles.includes(role))
}
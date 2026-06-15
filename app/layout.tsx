import type { Metadata } from 'next'
import { Arsenal, Geist_Mono, Radley } from 'next/font/google'
import './globals.css'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'

const arsenal = Arsenal({
  variable: '--font-arsenal',
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
})

const radley = Radley({
  variable: '--font-radley',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Darbuotojo sistema',
  description: 'Darbuotojų zona, užduotys, grafikai ir pranešimai',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="lt"
      className={`${arsenal.variable} ${radley.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <MobileBottomNav />
      </body>
    </html>
  )
}

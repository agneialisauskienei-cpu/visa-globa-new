import type { Metadata } from 'next'
import { Geist_Mono, Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
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
      className={`${inter.variable} ${playfair.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <MobileBottomNav />
      </body>
    </html>
  )
}

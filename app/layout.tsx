import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'PulsePass — Campus Event & VIP Pass Engine',
    template: '%s | PulsePass',
  },
  description:
    'The next-generation campus event management platform. Claim digital VIP passes, scan QR tickets, and manage events in real-time.',
  keywords: ['campus events', 'event management', 'VIP passes', 'QR tickets', 'university', 'student events'],
  authors: [{ name: 'PulsePass' }],
  openGraph: {
    title: 'PulsePass — Campus Event & VIP Pass Engine',
    description: 'Claim digital VIP passes and manage campus events in real-time.',
    type: 'website',
    siteName: 'PulsePass',
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-obsidian-900 text-white antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#121619',
              color: '#E8EDF2',
              border: '1px solid rgba(0,255,102,0.2)',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            },
            success: {
              iconTheme: { primary: '#00FF66', secondary: '#0A0D0F' },
            },
            error: {
              iconTheme: { primary: '#FF3250', secondary: '#0A0D0F' },
            },
          }}
        />
      </body>
    </html>
  )
}

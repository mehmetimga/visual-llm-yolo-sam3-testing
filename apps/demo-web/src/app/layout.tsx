import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Casino Demo - AI UI Testing',
  description: 'Demo casino app for AI UI automation testing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen animated-bg">
        {children}
      </body>
    </html>
  )
}


import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Virtual NPC Generator',
  description: 'A living NPC that can talk back naturally',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

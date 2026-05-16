import type { Metadata } from 'next'
import './globals.css'
import NavBar from './navbar'

export const metadata: Metadata = {
  title: 'FinanzasEdu',
  description: 'Plataforma de educación financiera',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body>
        <NavBar />
        <main className="min-h-screen bg-gray-50">{children}</main>
      </body>
    </html>
  )
}
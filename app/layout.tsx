import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinanzasEdu',
  description: 'Plataforma de educación financiera',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={geist.className}>
        <nav className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow-md">
          <Link href="/" className="text-xl font-bold tracking-tight">💰 FinanzasEdu</Link>
          <div className="flex gap-6 text-sm font-medium">
            <Link href="/gastos" className="hover:text-blue-200 transition-colors">Mis Gastos</Link>
            <Link href="/amortizacion" className="hover:text-blue-200 transition-colors">Créditos</Link>
            <Link href="/auth/login" className="bg-white text-blue-700 px-4 py-1.5 rounded-full hover:bg-blue-50 transition-colors">Ingresar</Link>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  )
}
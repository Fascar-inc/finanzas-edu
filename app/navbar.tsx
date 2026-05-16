'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NavBar() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      setLoggedIn(!!data.session)
      setLoading(false)
    }

    checkSession()

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow-md">
      <Link href="/" className="text-xl font-bold tracking-tight">
        💰 FinanzasEdu
      </Link>

      <div className="flex gap-6 text-sm font-medium items-center">
        <Link href="/gastos" className="hover:text-blue-200 transition-colors">
          Mis Gastos
        </Link>
        <Link href="/amortizacion" className="hover:text-blue-200 transition-colors">
          Créditos
        </Link>

        {loading ? (
          <span className="opacity-70 text-sm">Cargando...</span>
        ) : loggedIn ? (
          <button
            onClick={handleLogout}
            className="bg-white text-blue-700 px-4 py-1.5 rounded-full hover:bg-blue-50 transition-colors"
          >
            Salir
          </button>
        ) : (
          <Link
            href="/auth/login"
            className="bg-white text-blue-700 px-4 py-1.5 rounded-full hover:bg-blue-50 transition-colors"
          >
            Ingresar
          </Link>
        )}
      </div>
    </nav>
  )
}
import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] text-center px-4">
      <h1 className="text-5xl font-bold text-blue-700 mb-4">💰 FinanzasEdu</h1>
      <p className="text-xl text-gray-600 mb-2 max-w-xl">
        Aprende a manejar tu dinero, controla tus gastos y entiende tus créditos.
      </p>
      <p className="text-gray-400 mb-10">Plataforma gratuita de educación financiera para Colombia</p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link href="/auth/register" className="bg-blue-700 text-white px-8 py-3 rounded-xl text-lg font-semibold hover:bg-blue-800 transition-colors">
          Crear cuenta gratis
        </Link>
        <Link href="/auth/login" className="border-2 border-blue-700 text-blue-700 px-8 py-3 rounded-xl text-lg font-semibold hover:bg-blue-50 transition-colors">
          Iniciar sesión
        </Link>
      </div>
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="font-semibold text-gray-800 mb-1">Registra tus gastos</h3>
          <p className="text-gray-500 text-sm">Categoriza tus gastos y controla tu presupuesto mensual</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-3xl mb-3">🏦</div>
          <h3 className="font-semibold text-gray-800 mb-1">Calcula tus créditos</h3>
          <p className="text-gray-500 text-sm">Genera tablas de amortización para cualquier tipo de crédito</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="font-semibold text-gray-800 mb-1">Toma decisiones</h3>
          <p className="text-gray-500 text-sm">Con información clara para mejorar tu salud financiera</p>
        </div>
      </div>
    </div>
  )
}
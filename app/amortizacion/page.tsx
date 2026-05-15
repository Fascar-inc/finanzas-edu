'use client'
import { useState } from 'react'
import { frenchSystem, germanSystem, AmortizationRow } from '@/lib/amortization'
import { createClient } from '@/lib/supabase'

const formatCOP = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function AmortizacionPage() {
  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [annualRate, setAnnualRate] = useState('')
  const [months, setMonths] = useState('')
  const [system, setSystem] = useState<'frances' | 'aleman'>('frances')
  const [rows, setRows] = useState<AmortizationRow[]>([])
  const [summary, setSummary] = useState<{ totalPaid: number; totalInterest: number; monthlyPayment: number } | null>(null)
  const [saved, setSaved] = useState(false)

  const calculate = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseFloat(principal)
    const r = parseFloat(annualRate)
    const m = parseInt(months)
    const result = system === 'frances' ? frenchSystem(p, r, m) : germanSystem(p, r, m)
    setRows(result)
    const totalPaid = result.reduce((s, r) => s + r.payment, 0)
    const totalInterest = result.reduce((s, r) => s + r.interest, 0)
    setSummary({ totalPaid, totalInterest, monthlyPayment: result[0]?.payment || 0 })
    setSaved(false)
  }

  const saveTable = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Debes iniciar sesión para guardar'); return }
    await supabase.from('amortization_tables').insert({
      user_id: user.id, name, principal: parseFloat(principal),
      annual_rate: parseFloat(annualRate), months: parseInt(months), system
    })
    setSaved(true)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Calculadora de Créditos</h1>
      <p className="text-gray-500 mb-8">Genera la tabla de amortización de cualquier crédito</p>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">📋 Datos del crédito</h2>
        <form onSubmit={calculate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nombre del crédito</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Crédito vivienda"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Monto del crédito (COP)</label>
            <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="Ej: 50000000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required min="0" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tasa de interés anual (%)</label>
            <input type="number" value={annualRate} onChange={e => setAnnualRate(e.target.value)} placeholder="Ej: 12.5"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required min="0" step="0.01" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Plazo (meses)</label>
            <input type="number" value={months} onChange={e => setMonths(e.target.value)} placeholder="Ej: 60"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required min="1" max="600" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Sistema de amortización</label>
            <select value={system} onChange={e => setSystem(e.target.value as 'frances' | 'aleman')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="frances">🇫🇷 Sistema Francés (cuota fija)</option>
              <option value="aleman">🇩🇪 Sistema Alemán (cuota decreciente)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full bg-blue-700 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors text-sm">
              Calcular tabla
            </button>
          </div>
        </form>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
              <p className="text-sm text-blue-600 font-medium mb-1">
                {system === 'frances' ? 'Cuota mensual fija' : 'Primera cuota'}
              </p>
              <p className="text-2xl font-bold text-blue-700">{formatCOP(summary.monthlyPayment)}</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
              <p className="text-sm text-orange-600 font-medium mb-1">Total de intereses</p>
              <p className="text-2xl font-bold text-orange-700">{formatCOP(summary.totalInterest)}</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
              <p className="text-sm text-green-600 font-medium mb-1">Total a pagar</p>
              <p className="text-2xl font-bold text-green-700">{formatCOP(summary.totalPaid)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">📊 Tabla de amortización — {name}</h2>
              <button onClick={saveTable} disabled={saved}
                className="text-sm bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
                {saved ? '✓ Guardada' : '💾 Guardar tabla'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-3 text-gray-600 font-medium rounded-l-xl">#</th>
                    <th className="text-right py-3 px-3 text-gray-600 font-medium">Cuota</th>
                    <th className="text-right py-3 px-3 text-gray-600 font-medium">Capital</th>
                    <th className="text-right py-3 px-3 text-gray-600 font-medium">Interés</th>
                    <th className="text-right py-3 px-3 text-gray-600 font-medium rounded-r-xl">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.period} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 text-gray-500">{row.period}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-gray-800">{formatCOP(row.payment)}</td>
                      <td className="py-2.5 px-3 text-right text-green-600">{formatCOP(row.principal)}</td>
                      <td className="py-2.5 px-3 text-right text-orange-500">{formatCOP(row.interest)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">{formatCOP(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
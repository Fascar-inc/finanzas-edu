'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/categories'
import Link from 'next/link'

type Expense = {
  id: string
  description: string
  amount: number
  category: string
  date: string
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)

export default function GastosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('mercado')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>({})
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('')

  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/auth/login'
        return
      }

      setUserId(user.id)

      const { data: exp } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      setExpenses((exp as Expense[]) || [])

      const { data: bud } = await supabase
        .from('budget')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)

      const limits: Record<string, number> = {}
      bud?.forEach((b: any) => {
        limits[b.category] = Number(b.monthly_limit)
      })
      setBudgetLimits(limits)
    }

    init()
  }, [])

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setLoading(true)
    const supabase = createClient()

    const payload = {
      description,
      amount: Number(amount),
      category,
      date,
      user_id: userId,
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      setExpenses([data as Expense, ...expenses])
      setDescription('')
      setAmount('')
      setCategory('mercado')
    }

    setLoading(false)
  }

  const deleteExpense = async (id: string) => {
    const supabase = createClient()
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(expenses.filter((e) => e.id !== id))
  }

  const saveBudget = async (cat: string) => {
    if (!userId) return
    const val = Number(budgetInput)
    if (Number.isNaN(val)) return

    const supabase = createClient()
    await supabase.from('budget').upsert(
      {
        user_id: userId,
        category: cat,
        monthly_limit: val,
        month: currentMonth,
      },
      { onConflict: 'user_id,category,month' }
    )

    setBudgetLimits({ ...budgetLimits, [cat]: val })
    setEditingBudget(null)
    setBudgetInput('')
  }

  const monthExpenses = expenses.filter((e) => e.date?.startsWith(currentMonth))
  const totalMonth = monthExpenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Mis Gastos</h1>
          <p className="text-gray-500">Controla tus gastos y presupuesto mensual</p>
        </div>
        <Link href="/amortizacion" className="text-sm text-blue-700 hover:underline">
          Ir a créditos
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 mt-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">➕ Registrar gasto</h2>
          <form onSubmit={addExpense} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              placeholder="Monto en COP"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              min="0"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-700 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? 'Guardando...' : 'Agregar gasto'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">📅 Resumen del mes</h2>
          <div className="text-3xl font-bold text-blue-700 mb-1">{formatCOP(totalMonth)}</div>
          <p className="text-gray-500 text-sm mb-4">Total gastado este mes</p>

          <div className="flex flex-col gap-3">
            {CATEGORIES.filter((cat) => monthExpenses.some((e) => e.category === cat.id)).map((cat) => {
              const spent = monthExpenses
                .filter((e) => e.category === cat.id)
                .reduce((s, e) => s + Number(e.amount), 0)
              const limit = budgetLimits[cat.id] || 0
              const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0

              return (
                <div key={cat.id}>
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                    <span>{cat.label}</span>
                    <span>
                      {formatCOP(spent)}
                      {limit > 0 ? ` / ${formatCOP(limit)}` : ''}
                    </span>
                  </div>
                  {limit > 0 && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">🎯 Límites de presupuesto (este mes)</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-lg mb-1">{cat.label.split(' ')[0]}</div>
              <div className="text-xs text-gray-500 mb-2">{cat.label.split(' ').slice(1).join(' ')}</div>
              {editingBudget === cat.id ? (
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="Límite"
                    className="border rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => saveBudget(cat.id)}
                      className="flex-1 bg-blue-700 text-white rounded-lg py-1 text-xs hover:bg-blue-800"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingBudget(null)}
                      className="flex-1 bg-gray-100 rounded-lg py-1 text-xs hover:bg-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingBudget(cat.id)
                    setBudgetInput(String(budgetLimits[cat.id] || ''))
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {budgetLimits[cat.id] ? formatCOP(budgetLimits[cat.id]) : 'Fijar límite'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 mb-4">🧾 Todos los gastos</h2>
        {expenses.length === 0 ? (
          <p className="text-gray-400 text-sm">Aún no has registrado gastos</p>
        ) : (
          <div className="flex flex-col gap-2">
            {expenses.map((exp) => {
              const cat = CATEGORIES.find((c) => c.id === exp.category)
              return (
                <div key={exp.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cat?.label.split(' ')[0]}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{exp.description}</p>
                      <p className="text-xs text-gray-400">
                        {exp.date} · {cat?.label.split(' ').slice(1).join(' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800">{formatCOP(Number(exp.amount))}</span>
                    <button
                      onClick={() => deleteExpense(exp.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-lg"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
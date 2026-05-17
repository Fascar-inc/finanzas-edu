'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/categories'
import Link from 'next/link'
import EmojiPicker from '@/components/EmojiPicker'

// ── Types ─────────────────────────────────────────────────────────────────

type Expense = {
  id: string
  description: string
  amount: number
  category: string
  date: string
}

type MonthlyConfig = {
  base_budget: number
  transport_enabled: boolean
  transport_amount: number
}

type CustomCategory = {
  id: string
  label: string
  icon: string
  color: string
}

type CategoryOption = {
  id: string
  label: string
  isCustom?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)

const getLast6Months = (): string[] => {
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }
  return months
}

const monthLabel = (m: string): string => {
  const [y, mo] = m.split('-')
  const date = new Date(Number(y), Number(mo) - 1, 1)
  return date.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
}

const DEFAULT_CONFIG: MonthlyConfig = {
  base_budget: 0,
  transport_enabled: false,
  transport_amount: 200000,
}

// ── Component ─────────────────────────────────────────────────────────────

export default function GastosPage() {
  const currentMonth = new Date().toISOString().slice(0, 7)

  // ── Core state
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // ── New expense form
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('mercado')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // ── Budget limits per category
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>({})
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('')

  // ── Monthly config (budget base + transport)
  const [monthlyConfig, setMonthlyConfig] = useState<MonthlyConfig>(DEFAULT_CONFIG)
  const [editingConfig, setEditingConfig] = useState(false)
  const [configForm, setConfigForm] = useState<MonthlyConfig>(DEFAULT_CONFIG)

  // ── Custom categories
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [catError, setCatError] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  // ── Monthly configs for evolution chart
  const [monthlyConfigs, setMonthlyConfigs] = useState<Record<string, MonthlyConfig>>({})

  // ── Derived: all categories (base + custom)
  const allCategories = useMemo<CategoryOption[]>(() => {
    const base = CATEGORIES.map((c) => ({ id: c.id, label: c.label, isCustom: false }))
    const custom = customCategories.map((c) => ({
      id: c.id,
      label: `${c.icon} ${c.label}`,
      isCustom: true,
    }))
    return [...base, ...custom]
  }, [customCategories])

  // ── Derived: current month figures
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.date?.startsWith(currentMonth)),
    [expenses, currentMonth]
  )
  const totalMonth = useMemo(
    () => monthExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [monthExpenses]
  )
  const transportValue = monthlyConfig.transport_enabled ? monthlyConfig.transport_amount : 0
  const totalBudget = monthlyConfig.base_budget + transportValue
  const remaining = totalBudget - totalMonth
  const budgetPct = totalBudget > 0 ? Math.min((totalMonth / totalBudget) * 100, 100) : 0
  const overBudget = totalBudget > 0 && totalMonth > totalBudget

  // ── Derived: evolution data (last 6 months)
  const evolutionData = useMemo(() => {
    return getLast6Months().map((m) => {
      const spent = expenses
        .filter((e) => e.date?.startsWith(m))
        .reduce((s, e) => s + Number(e.amount), 0)
      const cfg = monthlyConfigs[m] ?? DEFAULT_CONFIG
      const available = cfg.base_budget + (cfg.transport_enabled ? cfg.transport_amount : 0)
      return { month: m, label: monthLabel(m), spent, available, remaining: available - spent }
    })
  }, [expenses, monthlyConfigs])

  const maxEvolutionValue = useMemo(
    () => Math.max(...evolutionData.map((d) => Math.max(d.spent, d.available)), 1),
    [evolutionData]
  )

  // ── Init
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/auth/login'
        return
      }
      setUserId(user.id)

      // All expenses
      const { data: exp } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
      setExpenses((exp as Expense[]) ?? [])

      // Budget limits for current month
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

      // Monthly config for current month
      const { data: cfg } = await supabase
        .from('monthly_config')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .maybeSingle()
      if (cfg) {
        const loaded: MonthlyConfig = {
          base_budget: Number(cfg.base_budget),
          transport_enabled: Boolean(cfg.transport_enabled),
          transport_amount: Number(cfg.transport_amount),
        }
        setMonthlyConfig(loaded)
        setConfigForm(loaded)
      }

      // Custom categories
      const { data: cats } = await supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      setCustomCategories((cats as CustomCategory[]) ?? [])

      // Monthly configs for last 6 months (evolution chart)
      const last6 = getLast6Months()
      const { data: cfgs } = await supabase
        .from('monthly_config')
        .select('*')
        .eq('user_id', user.id)
        .in('month', last6)
      const configMap: Record<string, MonthlyConfig> = {}
      cfgs?.forEach((c: any) => {
        configMap[c.month] = {
          base_budget: Number(c.base_budget),
          transport_enabled: Boolean(c.transport_enabled),
          transport_amount: Number(c.transport_amount),
        }
      })
      setMonthlyConfigs(configMap)
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) {
      setFormError('El monto debe ser mayor a 0')
      return
    }
    setFormError('')
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('expenses')
      .insert({ description, amount: numAmount, category, date, user_id: userId })
      .select()
      .single()
    if (!error && data) {
      setExpenses([data as Expense, ...expenses])
      setDescription('')
      setAmount('')
      setCategory(allCategories[0]?.id ?? 'mercado')
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
    if (Number.isNaN(val) || val < 0) return
    const supabase = createClient()
    await supabase.from('budget').upsert(
      { user_id: userId, category: cat, monthly_limit: val, month: currentMonth },
      { onConflict: 'user_id,category,month' }
    )
    setBudgetLimits({ ...budgetLimits, [cat]: val })
    setEditingBudget(null)
    setBudgetInput('')
  }

  const saveMonthlyConfig = async () => {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('monthly_config').upsert(
      {
        user_id: userId,
        month: currentMonth,
        base_budget: configForm.base_budget,
        transport_enabled: configForm.transport_enabled,
        transport_amount: configForm.transport_amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,month' }
    )
    setMonthlyConfig(configForm)
    setMonthlyConfigs({ ...monthlyConfigs, [currentMonth]: configForm })
    setEditingConfig(false)
  }

  const addCustomCategory = async () => {
    if (!userId) return
    const label = newCatLabel.trim()
    if (!label) {
      setCatError('El nombre no puede estar vacío')
      return
    }
    const allLabels = [
      ...CATEGORIES.map((c) => c.label.toLowerCase()),
      ...customCategories.map((c) => c.label.toLowerCase()),
    ]
    if (allLabels.includes(label.toLowerCase())) {
      setCatError('Ya existe una categoría con ese nombre')
      return
    }
    setSavingCat(true)
    setCatError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_categories')
      .insert({ user_id: userId, label, icon: newCatIcon, color: '#6366f1' })
      .select()
      .single()
    if (!error && data) {
      setCustomCategories([...customCategories, data as CustomCategory])
      setNewCatLabel('')
      setNewCatIcon('📦')
      setShowAddCategory(false)
    } else if (error?.code === '23505') {
      setCatError('Ya existe una categoría con ese nombre')
    }
    setSavingCat(false)
  }

  const deleteCustomCategory = async (id: string) => {
    const supabase = createClient()
    await supabase.from('user_categories').delete().eq('id', id)
    setCustomCategories(customCategories.filter((c) => c.id !== id))
  }

  const getCategoryLabel = (catId: string): string => {
    const base = CATEGORIES.find((c) => c.id === catId)
    if (base) return base.label
    const custom = customCategories.find((c) => c.id === catId)
    if (custom) return `${custom.icon} ${custom.label}`
    return catId
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* ── Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Mis Gastos</h1>
          <p className="text-gray-500">Controla tus gastos y presupuesto mensual</p>
        </div>
        <Link href="/amortizacion" className="text-sm text-blue-700 hover:underline">
          Ir a créditos
        </Link>
      </div>

      {/* ── Row 1: Add expense + Month summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Add expense */}
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
            <div>
              <input
                type="number"
                placeholder="Monto en COP"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setFormError('') }}
                className={`border rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formError ? 'border-red-300' : 'border-gray-200'
                }`}
                required
                min="1"
              />
              {formError && <p className="text-red-500 text-xs mt-1">{formError}</p>}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.length > 0 && (
                <optgroup label="Categorías base">
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </optgroup>
              )}
              {customCategories.length > 0 && (
                <optgroup label="Mis categorías">
                  {customCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </optgroup>
              )}
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

        {/* Month summary */}
        <div className={`bg-white rounded-2xl p-6 shadow-sm border ${overBudget ? 'border-red-200' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">📅 Resumen del mes</h2>
            {overBudget && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                ⚠ Presupuesto superado
              </span>
            )}
          </div>

          {monthlyConfig.base_budget === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-4xl mb-3">💸</p>
              <p className="text-gray-500 text-sm mb-1">No has configurado tu presupuesto aún</p>
              <p className="text-gray-400 text-xs mb-4">
                Define tu presupuesto base para ver tu saldo disponible
              </p>
              <button
                onClick={() => setEditingConfig(true)}
                className="text-sm text-blue-700 font-semibold hover:underline"
              >
                Configurar presupuesto →
              </button>
            </div>
          ) : (
            <>
              {/* Figures grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Presupuesto base</p>
                  <p className="font-semibold text-gray-800 text-sm">{formatCOP(monthlyConfig.base_budget)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Auxilio transporte</p>
                  <p className="font-semibold text-gray-800 text-sm">
                    {monthlyConfig.transport_enabled ? formatCOP(monthlyConfig.transport_amount) : '—'}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 mb-0.5">Total disponible</p>
                  <p className="font-bold text-blue-700">{formatCOP(totalBudget)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Total gastado</p>
                  <p className="font-bold text-gray-800">{formatCOP(totalMonth)}</p>
                </div>
              </div>

              {/* Saldo restante + progress bar */}
              <div className={`rounded-xl p-3 mb-3 ${remaining < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex justify-between items-center mb-1">
                  <p className={`text-xs font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {remaining < 0 ? 'Excedido en' : 'Saldo restante'}
                  </p>
                  <p className={`text-xs font-semibold ${remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {budgetPct.toFixed(0)}% consumido
                  </p>
                </div>
                <p className={`font-bold text-xl ${remaining < 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {formatCOP(Math.abs(remaining))}
                </p>
                <div className="w-full bg-white/60 rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${budgetPct}%`,
                      backgroundColor:
                        budgetPct >= 100 ? '#ef4444' : budgetPct >= 80 ? '#f59e0b' : '#22c55e',
                    }}
                  />
                </div>
              </div>

              {/* Category breakdown */}
              <div className="flex flex-col gap-2">
                {allCategories
                  .filter((cat) => monthExpenses.some((e) => e.category === cat.id))
                  .map((cat) => {
                    const spent = monthExpenses
                      .filter((e) => e.category === cat.id)
                      .reduce((s, e) => s + Number(e.amount), 0)
                    const limit = budgetLimits[cat.id] ?? 0
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
                                backgroundColor:
                                  pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Monthly config */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">💰 Presupuesto mensual</h2>
          {!editingConfig && (
            <button
              onClick={() => { setConfigForm(monthlyConfig); setEditingConfig(true) }}
              className="text-xs text-blue-600 hover:underline"
            >
              {monthlyConfig.base_budget === 0 ? 'Configurar' : 'Editar'}
            </button>
          )}
        </div>

        {editingConfig ? (
          <div className="flex flex-col gap-3 max-w-sm">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Presupuesto base mensual (COP)</label>
              <input
                type="number"
                min="0"
                value={configForm.base_budget || ''}
                onChange={(e) => setConfigForm({ ...configForm, base_budget: Number(e.target.value) })}
                placeholder="Ej: 3000000"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={configForm.transport_enabled}
                  onChange={(e) => setConfigForm({ ...configForm, transport_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
              </div>
              <span className="text-sm text-gray-700">Recibo auxilio de transporte</span>
            </label>
            {configForm.transport_enabled && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Valor auxilio de transporte (COP)
                </label>
                <input
                  type="number"
                  min="0"
                  value={configForm.transport_amount || ''}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, transport_amount: Number(e.target.value) })
                  }
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveMonthlyConfig}
                className="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-800"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditingConfig(false)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Presupuesto base</p>
              <p className="font-semibold text-gray-800">
                {monthlyConfig.base_budget > 0 ? formatCOP(monthlyConfig.base_budget) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Auxilio de transporte</p>
              <p className="font-semibold text-gray-800">
                {monthlyConfig.transport_enabled
                  ? formatCOP(monthlyConfig.transport_amount)
                  : 'No aplica'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Total disponible</p>
              <p className="font-bold text-blue-700">
                {totalBudget > 0 ? formatCOP(totalBudget) : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Category limits */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">🎯 Límites por categoría (este mes)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {allCategories.map((cat) => (
            <div key={cat.id} className="border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-lg mb-1">{cat.label.split(' ')[0]}</div>
              <div className="text-xs text-gray-500 mb-2 leading-tight">
                {cat.label.split(' ').slice(1).join(' ')}
              </div>
              {editingBudget === cat.id ? (
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="Límite"
                    className="border rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    min="0"
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
                    setBudgetInput(String(budgetLimits[cat.id] ?? ''))
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

      {/* ── Custom categories */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">🏷️ Categorías personalizadas</h2>
          <button
            onClick={() => { setShowAddCategory(!showAddCategory); setCatError('') }}
            className="text-xs text-blue-600 hover:underline"
          >
            {showAddCategory ? 'Cancelar' : '+ Nueva categoría'}
          </button>
        </div>

        {showAddCategory && (
          <div className="flex flex-col gap-2 mb-4 max-w-sm">
            <div className="flex gap-2 items-center">
              <EmojiPicker value={newCatIcon} onChange={setNewCatIcon} />
              <input
                type="text"
                placeholder="Nombre de la categoría"
                value={newCatLabel}
                onChange={(e) => { setNewCatLabel(e.target.value); setCatError('') }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && addCustomCategory()}
                autoFocus
              />
              <button
                onClick={addCustomCategory}
                disabled={savingCat}
                className="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
              >
                {savingCat ? '...' : 'Agregar'}
              </button>
            </div>
            {catError && <p className="text-red-500 text-xs">{catError}</p>}
          </div>
        )}

        {customCategories.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Aún no tienes categorías personalizadas
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {customCategories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5"
              >
                <span>{cat.icon}</span>
                <span className="text-sm text-gray-700">{cat.label}</span>
                <button
                  onClick={() => deleteCustomCategory(cat.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-xs ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Month evolution */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold text-gray-800 mb-5">📈 Evolución de gastos (últimos 6 meses)</h2>

        {/* Bar chart */}
        <div className="flex items-end gap-2 h-36 mb-3 px-1">
          {evolutionData.map((d) => {
            const spentH = (d.spent / maxEvolutionValue) * 100
            const availH = (d.available / maxEvolutionValue) * 100
            const isCurrent = d.month === currentMonth
            const isOver = d.available > 0 && d.spent > d.available
            return (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="relative w-full flex items-end justify-center gap-1 h-28">
                  {/* Available bar */}
                  {d.available > 0 && (
                    <div
                      className="flex-1 rounded-t-md bg-blue-100"
                      style={{ height: `${Math.max(availH, 2)}%` }}
                      title={`Disponible: ${formatCOP(d.available)}`}
                    />
                  )}
                  {/* Spent bar */}
                  <div
                    className={`flex-1 rounded-t-md transition-all ${
                      isOver ? 'bg-red-400' : isCurrent ? 'bg-blue-600' : 'bg-blue-300'
                    }`}
                    style={{ height: `${Math.max(spentH, 2)}%` }}
                    title={`Gastado: ${formatCOP(d.spent)}`}
                  />
                </div>
                <span className={`text-xs ${isCurrent ? 'font-bold text-blue-700' : 'text-gray-400'}`}>
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-gray-400 mb-5">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-100 inline-block" />
            Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />
            Gastado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
            Excedido
          </span>
        </div>

        {/* Evolution table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Mes</th>
                <th className="pb-2 font-medium text-right">Disponible</th>
                <th className="pb-2 font-medium text-right">Gastado</th>
                <th className="pb-2 font-medium text-right">Saldo</th>
                <th className="pb-2 font-medium text-right">% usado</th>
              </tr>
            </thead>
            <tbody>
              {evolutionData.map((d) => {
                const pct = d.available > 0 ? Math.round((d.spent / d.available) * 100) : null
                const isOver = d.available > 0 && d.spent > d.available
                const isCurrent = d.month === currentMonth
                return (
                  <tr
                    key={d.month}
                    className={`border-b border-gray-50 ${isCurrent ? 'font-semibold' : ''}`}
                  >
                    <td className="py-2 text-gray-700">
                      {d.label}
                      {isCurrent && (
                        <span className="ml-1 text-blue-500 text-xs">★</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {d.available > 0 ? formatCOP(d.available) : '—'}
                    </td>
                    <td className="py-2 text-right text-gray-800">{formatCOP(d.spent)}</td>
                    <td className={`py-2 text-right ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                      {d.available > 0 ? formatCOP(d.remaining) : '—'}
                    </td>
                    <td
                      className={`py-2 text-right ${
                        pct === null
                          ? 'text-gray-400'
                          : pct >= 100
                          ? 'text-red-600'
                          : pct >= 80
                          ? 'text-amber-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── All expenses */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 mb-4">🧾 Todos los gastos</h2>
        {expenses.length === 0 ? (
          <p className="text-gray-400 text-sm">Aún no has registrado gastos</p>
        ) : (
          <div className="flex flex-col gap-2">
            {expenses.map((exp) => {
              const label = getCategoryLabel(exp.category)
              const icon = label.split(' ')[0]
              const catName = label.split(' ').slice(1).join(' ')
              return (
                <div
                  key={exp.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{exp.description}</p>
                      <p className="text-xs text-gray-400">
                        {exp.date} · {catName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800">
                      {formatCOP(Number(exp.amount))}
                    </span>
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
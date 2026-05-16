'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import * as XLSX from 'xlsx'

type Row = {
  period: number
  payment: number
  interest: number
  principal: number
  balance: number
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)

// ─── helpers sin cambios (para downloadExcel / referencia) ───────────────────

function fixedQuota(principal: number, ea: number, months: number): Row[] {
  const r = Math.pow(1 + ea / 100, 1 / 12) - 1
  const payment = principal * ((r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1))
  const rows: Row[] = []
  let balance = principal

  for (let i = 1; i <= months; i++) {
    const interest = balance * r
    const principalPaid = payment - interest
    balance -= principalPaid
    rows.push({
      period: i,
      payment: Math.round(payment),
      interest: Math.round(interest),
      principal: Math.round(principalPaid),
      balance: Math.max(0, Math.round(balance)),
    })
  }
  return rows
}

function decreasingQuota(principal: number, ea: number, months: number): Row[] {
  const r = Math.pow(1 + ea / 100, 1 / 12) - 1
  const principalPayment = principal / months
  const rows: Row[] = []
  let balance = principal

  for (let i = 1; i <= months; i++) {
    const interest = balance * r
    const payment = principalPayment + interest
    balance -= principalPayment
    rows.push({
      period: i,
      payment: Math.round(payment),
      interest: Math.round(interest),
      principal: Math.round(principalPayment),
      balance: Math.max(0, Math.round(balance)),
    })
  }
  return rows
}

// ─── NUEVO: generador unificado COP con abono real ───────────────────────────
/**
 * Construye la tabla de amortización en COP, aplicando correctamente
 * el abono mensual a capital y sumando seguro + cuota de manejo al pago mostrado.
 * `extraMonthly = 0` reproduce exactamente fixedQuota / decreasingQuota + fees.
 */
function buildCOPRows(
  principal: number,
  ea: number,
  months: number,
  system: 'fixed' | 'decreasing',
  extraMonthly: number,
  ins: number,
  fee: number,
): Row[] {
  const r = Math.pow(1 + ea / 100, 1 / 12) - 1

  // Cuota pura de amortización (sin seguros ni manejo)
  const fixedPayment =
    system === 'fixed'
      ? principal * ((r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1))
      : 0
  const regularPrincipal = system === 'decreasing' ? principal / months : 0

  const rows: Row[] = []
  let balance = principal
  let period = 1

  while (balance > 0.5 && period <= 1200) {
    const interest = balance * r

    // Capital abonado = porción de capital de la cuota regular + abono extra
    // Se limita al saldo pendiente para no pasarse
    let principalPaid: number
    if (system === 'fixed') {
      principalPaid = Math.max(0, Math.min(balance, fixedPayment - interest + extraMonthly))
    } else {
      principalPaid = Math.min(balance, regularPrincipal + extraMonthly)
    }

    balance = Math.max(0, balance - principalPaid)

    rows.push({
      period,
      payment: Math.round(principalPaid + interest + ins + fee),
      interest: Math.round(interest),
      principal: Math.round(principalPaid),
      balance: Math.round(balance),
    })

    period++
  }

  return rows
}

// ─── NUEVO: generador UVR real ────────────────────────────────────────────────
/**
 * Construye la tabla de amortización en UVR:
 *  - El saldo se mantiene en UVR, proyectando mes a mes con uvrGrowthAnnual.
 *  - La cuota y el saldo se convierten a pesos usando la UVR proyectada.
 *  - El abono extra (en COP) se convierte a UVR cada mes según la UVR vigente.
 *  - uvrInitial y uvrGrowthAnnual afectan directamente todos los resultados.
 */
function buildUVRRows(
  principalCOP: number,
  ea: number,
  months: number,
  system: 'fixed' | 'decreasing',
  uvrInitial: number,
  uvrGrowthAnnual: number,
  extraMonthlyCOP: number,
  ins: number,
  fee: number,
): Row[] {
  const r = Math.pow(1 + ea / 100, 1 / 12) - 1
  const monthlyGrowth = Math.pow(1 + uvrGrowthAnnual / 100, 1 / 12) - 1

  // Saldo inicial en UVR
  const principalUvr = principalCOP / uvrInitial

  // Cuota fija en UVR (si aplica)
  const fixedPaymentUvr =
    system === 'fixed'
      ? principalUvr * ((r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1))
      : 0
  const regularPrincipalUvr = system === 'decreasing' ? principalUvr / months : 0

  const rows: Row[] = []
  let balanceUvr = principalUvr
  let currentUvr = uvrInitial
  let period = 1

  while (balanceUvr > 0.0001 && period <= 1200) {
    // Proyectar UVR al mes actual
    currentUvr *= 1 + monthlyGrowth

    const interestUvr = balanceUvr * r
    // Convertir el abono extra de COP a UVR usando la UVR del mes
    const extraUvr = extraMonthlyCOP / currentUvr

    let principalPaidUvr: number
    if (system === 'fixed') {
      principalPaidUvr = Math.max(
        0,
        Math.min(balanceUvr, fixedPaymentUvr - interestUvr + extraUvr),
      )
    } else {
      principalPaidUvr = Math.min(balanceUvr, regularPrincipalUvr + extraUvr)
    }

    balanceUvr = Math.max(0, balanceUvr - principalPaidUvr)

    rows.push({
      period,
      payment: Math.round((principalPaidUvr + interestUvr) * currentUvr + ins + fee),
      interest: Math.round(interestUvr * currentUvr),
      principal: Math.round(principalPaidUvr * currentUvr),
      balance: Math.round(balanceUvr * currentUvr),
    })

    period++
  }

  return rows
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AmortizacionPage() {
  const [creditName, setCreditName] = useState('')
  const [creditType, setCreditType] = useState('consumo')
  const [currency, setCurrency] = useState('COP')
  const [principal, setPrincipal] = useState('')
  const [ea, setEa] = useState('')
  const [months, setMonths] = useState('')
  const [system, setSystem] = useState<'fixed' | 'decreasing'>('fixed')
  const [insurance, setInsurance] = useState('')
  const [managementFee, setManagementFee] = useState('')
  const [extraAbono, setExtraAbono] = useState('')
  const [uvrValue, setUvrValue] = useState('')
  const [uvrGrowth, setUvrGrowth] = useState('5.5')
  const [showUvrHelp, setShowUvrHelp] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [baseRows, setBaseRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<{
    totalPaid: number
    totalInterest: number
    firstPayment: number
    savedInterest: number
    savedMonths: number
    baseTotalInterest: number
    baseMonths: number
  } | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const calculate = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const p = Number(principal)
    const rate = Number(ea)
    const m = Number(months)
    const ins = Number(insurance || 0)
    const fee = Number(managementFee || 0)
    const extra = Number(extraAbono || 0)

    if (!p || !rate || !m) {
      setError('Completa monto, tasa EA y plazo.')
      return
    }

    if (currency === 'UVR' && !uvrValue) {
      setError('Ingresa la UVR actual para continuar.')
      return
    }

    // ── Validación: abono no puede superar el monto del préstamo ──
    if (extra > 0 && extra >= p) {
      setError(
        `El abono mensual a capital (${formatCOP(extra)}) no puede ser mayor o igual al monto del préstamo (${formatCOP(p)}). Ingresa un valor menor.`,
      )
      return
    }

    if (currency === 'COP') {
      // Escenario base (sin abono extra) para calcular el ahorro
      const noExtraRows = buildCOPRows(p, rate, m, system, 0, ins, fee)
      // Escenario con abono
      const finalRows = extra > 0 ? buildCOPRows(p, rate, m, system, extra, ins, fee) : noExtraRows

      setBaseRows(noExtraRows)
      setRows(finalRows)

      const totalPaid = finalRows.reduce((s, r) => s + r.payment, 0)
      const totalInterest = finalRows.reduce((s, r) => s + r.interest, 0)
      const baseTotalInterest = noExtraRows.reduce((s, r) => s + r.interest, 0)
      const savedMonths = noExtraRows.length - finalRows.length

      setSummary({
        totalPaid,
        totalInterest,
        firstPayment: finalRows[0]?.payment || 0,
        savedInterest: Math.max(0, baseTotalInterest - totalInterest),
        savedMonths: Math.max(0, savedMonths),
        baseTotalInterest,
        baseMonths: noExtraRows.length,
      })
    } else {
      // ── UVR ──
      const uvr = Number(uvrValue)
      const growth = Number(uvrGrowth || 0)

      // Escenario base UVR (sin abono extra)
      const baseUvrRows = buildUVRRows(p, rate, m, system, uvr, growth, 0, ins, fee)
      // Escenario con abono
      const finalRows =
        extra > 0 ? buildUVRRows(p, rate, m, system, uvr, growth, extra, ins, fee) : baseUvrRows

      setBaseRows(baseUvrRows)
      setRows(finalRows)

      const totalPaid = finalRows.reduce((s, r) => s + r.payment, 0)
      const totalInterest = finalRows.reduce((s, r) => s + r.interest, 0)
      const baseTotalInterest = baseUvrRows.reduce((s, r) => s + r.interest, 0)
      const savedMonths = baseUvrRows.length - finalRows.length

      setSummary({
        totalPaid,
        totalInterest,
        firstPayment: finalRows[0]?.payment || 0,
        savedInterest: Math.max(0, baseTotalInterest - totalInterest),
        savedMonths: Math.max(0, savedMonths),
        baseTotalInterest,
        baseMonths: baseUvrRows.length,
      })
    }

    setSaved(false)
  }

  const saveTable = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Debes iniciar sesión para guardar la tabla.')
      return
    }

    const { error } = await supabase.from('amortization_tables').insert({
      user_id: user.id,
      name: creditName,
      principal: Number(principal),
      annual_rate: Number(ea),
      months: Number(months),
      system,
    })

    if (error) {
      setError('No se pudo guardar la tabla: ' + error.message)
      return
    }

    setSaved(true)
  }

  const downloadExcel = () => {
    const worksheetData = [
      ['Nombre', creditName],
      ['Tipo de crédito', creditType],
      ['Moneda', currency],
      ['Monto', Number(principal)],
      ['Tasa EA (%)', Number(ea)],
      ['Plazo original (meses)', Number(months)],
      ['Sistema', system === 'fixed' ? 'Cuota fija' : 'Cuota decreciente'],
      ['Seguro mensual', Number(insurance || 0)],
      ['Cuota de manejo', Number(managementFee || 0)],
      ['Abono mensual a capital', Number(extraAbono || 0)],
      ['UVR ingresada', Number(uvrValue || 0)],
      ['Crecimiento anual UVR (%)', Number(uvrGrowth || 0)],
      [],
      ['Periodo', 'Cuota', 'Capital', 'Interés', 'Saldo'],
      ...rows.map((r) => [r.period, r.payment, r.principal, r.interest, r.balance]),
      [],
      ['Resumen', 'Valor'],
      ['Total pagado', summary?.totalPaid || 0],
      ['Total intereses', summary?.totalInterest || 0],
      ['Ahorro en intereses', summary?.savedInterest || 0],
      ['Meses ahorrados', summary?.savedMonths || 0],
    ]

    const ws = XLSX.utils.aoa_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Amortizacion')
    XLSX.writeFile(wb, `${creditName || 'amortizacion'}.xlsx`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Calculadora de Créditos</h1>
          <p className="text-gray-500">Tabla de cuotas más realista para Colombia</p>
        </div>
        <Link href="/gastos" className="text-sm text-blue-700 hover:underline">
          Ir a gastos
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mt-6">
        <h2 className="font-semibold text-gray-800 mb-4">📋 Datos del crédito</h2>

        <form onSubmit={calculate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nombre del crédito</label>
            <input
              type="text"
              value={creditName}
              onChange={(e) => setCreditName(e.target.value)}
              placeholder="Ej: Crédito libre inversión"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de crédito</label>
            <select
              value={creditType}
              onChange={(e) => setCreditType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="consumo">Consumo</option>
              <option value="vivienda">Vivienda</option>
              <option value="tarjeta">Tarjeta de crédito</option>
              <option value="vehiculo">Vehículo</option>
              <option value="educacion">Educación</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Moneda</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="COP">Pesos colombianos (COP)</option>
              <option value="UVR">UVR</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Monto del crédito</label>
            <input
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="Ej: 50000000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tasa EA (%)</label>
            <input
              type="number"
              step="0.01"
              value={ea}
              onChange={(e) => setEa(e.target.value)}
              placeholder="Ej: 18.5"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Plazo en meses</label>
            <input
              type="number"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              placeholder="Ej: 60"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Sistema de amortización</label>
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value as 'fixed' | 'decreasing')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fixed">Cuota fija</option>
              <option value="decreasing">Cuota decreciente</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Seguro obligatorio mensual</label>
            <input
              type="number"
              value={insurance}
              onChange={(e) => setInsurance(e.target.value)}
              placeholder="Ej: 45000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Cuota de manejo mensual</label>
            <input
              type="number"
              value={managementFee}
              onChange={(e) => setManagementFee(e.target.value)}
              placeholder="Ej: 12000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Abono mensual a capital</label>
            <input
              type="number"
              value={extraAbono}
              onChange={(e) => setExtraAbono(e.target.value)}
              placeholder="Ej: 200000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {currency === 'UVR' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">UVR actual</label>
                <input
                  type="number"
                  step="0.0001"
                  value={uvrValue}
                  onChange={(e) => setUvrValue(e.target.value)}
                  placeholder="Consulta La República y pégala aquí"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Crecimiento anual UVR (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={uvrGrowth}
                  onChange={(e) => setUvrGrowth(e.target.value)}
                  placeholder="Ej: 5.5"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <button
                  type="button"
                  onClick={() => setShowUvrHelp(true)}
                  className="mt-1 text-sm text-blue-700 hover:text-blue-800 underline underline-offset-2"
                >
                  ¿Dónde consulto la UVR?
                </button>
              </div>
            </>
          )}

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-blue-700 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors text-sm"
            >
              Calcular tabla
            </button>
          </div>
        </form>

        {showUvrHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowUvrHelp(false)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Consulta la UVR</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Abre la fuente, copia el valor actual de la UVR y pégalo en el campo de arriba.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUvrHelp(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="https://www.larepublica.co/indicadores-economicos/bancos/uvr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors"
                >
                  Abrir fuente
                </a>

                <button
                  type="button"
                  onClick={() => setShowUvrHelp(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-4">
          Cuota fija: pagas casi lo mismo cada mes. Cuota decreciente: al inicio pagas más y luego menos.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Esta calculadora hace una estimación educativa. Los resultados pueden variar según las condiciones reales del crédito, seguros, comisiones y reglas de la entidad financiera.
        </p>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-6">
            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
              <p className="text-sm text-blue-600 font-medium mb-1">Primera cuota</p>
              <p className="text-2xl font-bold text-blue-700">{formatCOP(summary.firstPayment)}</p>
            </div>

            <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
              <p className="text-sm text-orange-600 font-medium mb-1">Total de intereses</p>
              <p className="text-2xl font-bold text-orange-700">{formatCOP(summary.totalInterest)}</p>
              {summary.savedInterest > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  Ahorro estimado: {formatCOP(summary.savedInterest)}
                </p>
              )}
            </div>

            <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
              <p className="text-sm text-green-600 font-medium mb-1">Total a pagar</p>
              <p className="text-2xl font-bold text-green-700">{formatCOP(summary.totalPaid)}</p>
              {summary.savedMonths > 0 && (
                <p className="text-xs text-green-600 mt-1">Meses ahorrados: {summary.savedMonths}</p>
              )}
            </div>
          </div>

          {/* Tarjeta de ahorro: solo visible cuando extraAbono > 0 */}
          {Number(extraAbono) > 0 && (
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-6">
              <p className="text-sm text-slate-600 font-medium mb-1">Ahorro por abono a capital</p>
              <p className="text-2xl font-bold text-slate-800">
                {formatCOP(summary.savedInterest)}
              </p>
              {summary.savedMonths > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Meses ahorrados: {summary.savedMonths}
                </p>
              )}
              {summary.savedInterest === 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  El abono no generó ahorro en intereses en este escenario.
                </p>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">📊 Tabla de amortización</h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadExcel}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  ⬇ Descargar Excel
                </button>
                <button
                  onClick={saveTable}
                  disabled={saved}
                  className="text-sm bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saved ? '✓ Guardada' : '💾 Guardar tabla'}
                </button>
              </div>
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
                  {rows.map((row) => (
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
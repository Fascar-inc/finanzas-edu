export type AmortizationRow = {
  period: number
  payment: number
  interest: number
  principal: number
  balance: number
}

export function frenchSystem(principal: number, annualRate: number, months: number): AmortizationRow[] {
  const r = annualRate / 100 / 12
  const payment = principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
  const rows: AmortizationRow[] = []
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
      balance: Math.max(0, Math.round(balance))
    })
  }
  return rows
}

export function germanSystem(principal: number, annualRate: number, months: number): AmortizationRow[] {
  const r = annualRate / 100 / 12
  const principalPayment = principal / months
  const rows: AmortizationRow[] = []
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
      balance: Math.max(0, Math.round(balance))
    })
  }
  return rows
}
import type { GlobalSettings, Machine, PaymentStatus } from '../types'

/** Amortization rate: straight-line over useful life hours, minus residual value. */
export function amortizationRate(machine: Machine): number {
  return (machine.purchasePrice - machine.residualValue) / machine.usefulLifeHours
}

/** Maintenance rate: annual maintenance cost spread over expected annual usage. */
export function maintenanceRate(machine: Machine): number {
  return machine.annualMaintenanceCost / machine.annualUsageHours
}

/** Total hourly wear rate = amortization + maintenance. */
export function wearRate(machine: Machine): number {
  return amortizationRate(machine) + maintenanceRate(machine)
}

export interface QuoteInput {
  grams: number
  printHours: number
  laborCost: number | null
  priceTotal: number
}

export interface QuoteBreakdown {
  materialCost: number
  energyCost: number
  wearCost: number
  laborCost: number
  totalCost: number
  profit: number
  marginPct: number | null
}

/**
 * Computes the full cost breakdown for a quote, matching the owner's prototype:
 *   material = grams × (price per 1000g / 1000)
 *   energy   = (watts / 1000) × hours × rate per kWh
 *   wear     = hours × (amort + maint) rate of the machine
 *   total    = material + energy + wear + labor (labor optional)
 *   profit   = price − total
 */
export function calculateQuote(
  machine: Machine,
  materialPricePer1000g: number,
  settings: GlobalSettings,
  input: QuoteInput,
): QuoteBreakdown {
  const materialCost = input.grams * (materialPricePer1000g / 1000)
  const energyCost = (settings.printerWatts / 1000) * input.printHours * settings.electricityRateKwh
  const wearCost = input.printHours * wearRate(machine)
  const laborCost = input.laborCost ?? 0
  const totalCost = materialCost + energyCost + wearCost + laborCost
  const profit = input.priceTotal - totalCost
  const marginPct = input.priceTotal > 0 ? (profit / input.priceTotal) * 100 : null

  return { materialCost, energyCost, wearCost, laborCost, totalCost, profit, marginPct }
}

/** Payment status derived from amount paid vs. total price (never stored). */
export function paymentStatus(priceTotal: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return 'Pendiente'
  if (amountPaid >= priceTotal) return 'Pagado'
  return 'Pago Parcial'
}

/** Rounds to 2 decimals for currency display and storage. */
export function money(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

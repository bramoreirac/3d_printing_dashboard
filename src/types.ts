export interface GlobalSettings {
  printerWatts: number
  electricityRateKwh: number
  currency: 'USD'
}

export interface Machine {
  id: string
  name: string
  icon: 'print' | 'cube' | 'cubes' | 'gear'
  purchasePrice: number
  usefulLifeHours: number
  residualValue: number
  annualUsageHours: number
  annualMaintenanceCost: number
  isActive: boolean
}

export interface Material {
  id: string
  name: string
  costPer1000g: number
  supplyId: string
  isActive: boolean
}

export interface Supply {
  id: string
  name: string
  unit: 'g' | 'm' | 'pcs'
  minThreshold: number
  adjustments: StockAdjustment[]
}

export interface StockAdjustment {
  id: string
  delta: number
  reason: string
  createdAt: string
}

export interface MaintenanceRecord {
  id: string
  machineId: string
  performedAt: string
  description: string
  cost: number
  nextDueAt: string | null
}

export interface Order {
  id: string
  machineId: string
  materialId: string
  clientName: string
  designName: string
  orderDate: string
  grams: number
  printHours: number
  laborCost: number | null
  priceTotal: number
  amountPaid: number
  // Cost snapshot at save time — later rate changes never alter historical orders.
  materialPricePer1000g: number
  materialCost: number
  energyCost: number
  wearCost: number
  totalCost: number
  profit: number
  status: 'open' | 'completed' | 'cancelled'
}

export type PaymentStatus = 'Pagado' | 'Pago Parcial' | 'Pendiente'
